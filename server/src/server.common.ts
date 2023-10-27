
import {
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult,
	_Connection,
	HoverParams,
	Hover,
	MarkupContent,
	MarkupKind,
	Range,
	Position,
	CodeActionParams,
	CodeAction,
	DocumentUri,
} from "vscode-languageserver";

import {
	TextDocument
} from "vscode-languageserver-textdocument";

import { validator, errors } from "@openfga/syntax-transformer";

import { defaultDocumentationMap } from "./documentation";
import { getDuplicationFix, getMissingDefinitionFix, getReservedTypeNameFix } from "./code-action";
import { LineCounter, parseDocument } from "yaml";
import { rangeFromLinePos } from "./yaml-schema";
import { BlockMap, SourceToken } from "yaml/dist/parse/cst";

export function startServer(connection: _Connection) {

	console.log = connection.console.log.bind(connection.console);
	console.error = connection.console.error.bind(connection.console);

	// Create a simple text document manager.
	const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

	let hasConfigurationCapability = false;
	let hasWorkspaceFolderCapability = false;
	let hasDiagnosticRelatedInformationCapability = false;


	connection.onInitialize((params: InitializeParams) => {

		console.log("Initialize openfga language server");

		const capabilities = params.capabilities;

		// Does the client support the `workspace/configuration` request?
		// If not, we fall back using global settings.
		hasConfigurationCapability = !!(
			capabilities.workspace && !!capabilities.workspace.configuration
		);
		hasWorkspaceFolderCapability = !!(
			capabilities.workspace && !!capabilities.workspace.workspaceFolders
		);
		hasDiagnosticRelatedInformationCapability = !!(
			capabilities.textDocument &&
			capabilities.textDocument.publishDiagnostics &&
			capabilities.textDocument.publishDiagnostics.relatedInformation
		);

		const result: InitializeResult = {
			capabilities: {
				textDocumentSync: TextDocumentSyncKind.Incremental,
				// Tell the client that this server supports code completion.
				completionProvider: {
					resolveProvider: false
				},
				hoverProvider: true,
				codeActionProvider: true,
			}
		};
		if (hasWorkspaceFolderCapability) {
			result.capabilities.workspace = {
				workspaceFolders: {
					supported: true
				}
			};
		}

		console.log("hasConfigurationCapability: " + hasConfigurationCapability);
		console.log("hasWorkspaceFolderCapability: " + hasWorkspaceFolderCapability);
		console.log("hasDiagnosticRelatedInformationCapability: " + hasDiagnosticRelatedInformationCapability);

		return result;
	});


	connection.onInitialized(() => {
		if (hasConfigurationCapability) {
			// Register for all configuration changes.
			connection.client.register(DidChangeConfigurationNotification.type, undefined);
		}
		if (hasWorkspaceFolderCapability) {
			connection.workspace.onDidChangeWorkspaceFolders(_event => {
				connection.console.log("Workspace folder change event received.");
			});
		}
	});

	connection.onDidChangeConfiguration(_change => {
		// Revalidate all open text documents
		documents.all().forEach(validateTextDocument);
	});

	// The content of a text document has changed. This event is emitted
	// when the text document first opened or when its content has changed.
	documents.onDidChangeContent(change => {
		validateTextDocument(change.document);
	});

	documents.onDidClose(change => {
		connection.sendDiagnostics({
			uri: change.document.uri,
			diagnostics: [],
		});
	});

	const createDiagnostics = (err: errors.DSLSyntaxError | errors.ModelValidationError): Diagnostic[] => {
		return err.errors.map((e: errors.DSLSyntaxSingleError | errors.ModelValidationSingleError) => {
			const lines = e.getLine(-1);
			let characters;
			let source;

			let code = errors.ValidationError.InvalidSyntax;

			if (e instanceof errors.DSLSyntaxSingleError) {
				characters = e.getColumn();
				source = "SyntaxError";
			} else if (e instanceof errors.ModelValidationSingleError) {
				characters = e.getColumn(-1);
				source = "ModelValidationError";
				if (e.metadata?.errorType) {
					code = e.metadata.errorType;
				}
			} else {
				throw new Error("Unhandled Exception: " + JSON.stringify(e, null, 4));
			}

			return {
				message: e.msg,
				severity: DiagnosticSeverity.Error,
				range: {
					start: { line: lines.start, character: characters.start },
					end: { line: lines.end, character: characters.end },
				},
				source,
				code,
				data: e.metadata,
			};
		}) || [];
	};

	function getDiagnosticsForDsl(dsl: string): Diagnostic[] {
		try {
			validator.validateDSL(dsl);
		} catch (err) {
			if (err instanceof errors.DSLSyntaxError || err instanceof errors.ModelValidationError) {
				return createDiagnostics(err);
			} else {
				console.error("Unhandled Exception: " + err);
			}
		}
		return [];
	}

	function validateDSL(textDocument: TextDocument): void {
		connection.sendDiagnostics({
			uri: textDocument.uri,
			diagnostics: [],
		});

		const diagnostics = getDiagnosticsForDsl(textDocument.getText());
		connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
	}

	function validateYAML(textDocument: TextDocument): void {
		connection.sendDiagnostics({
			uri: textDocument.uri,
			diagnostics: [],
		});

		const diagnostics: Diagnostic[] = [];

		const lineCounter = new LineCounter();
		const doc = parseDocument(textDocument.getText(), {
			lineCounter,
			keepSourceTokens: true,
			uniqueKeys: false
		});

		// Basic syntax errors
		for (const err of doc.errors) {
			diagnostics.push({ message: err.message, range: rangeFromLinePos(err.linePos) });
		}

		// Get location of model in CST
		if (doc.has("model")) {
			let position: {line: number, col: number};

			// Get the model token and find its position
			(doc.contents?.srcToken as BlockMap).items.forEach(i => {
				if (i.key?.offset !== undefined && (i.key as SourceToken).source === "model") {
					position = lineCounter.linePos(i.key?.offset);
				}
			});

			// Shift generated diagnostics by line of model, and indent of 2
			let dslDiagnostics = getDiagnosticsForDsl(doc.get("model") as string);
			dslDiagnostics = dslDiagnostics.map(d => {
				const r = d.range;
				r.start.line += position.line;
				r.start.character += 2;
				r.end.line += position.line;
				r.end.character += 2;
				return d;
			});
			diagnostics.push(...dslDiagnostics);
		}

		connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
	}


	function validateTextDocument(textDocument: TextDocument): void {
		if (textDocument.languageId === "openfga") {
			validateDSL(textDocument);
		} else if (textDocument.languageId === "yaml") {
			validateYAML(textDocument);
		}
	}

	connection.onCodeAction((params: CodeActionParams) => {
		const diagnostics = params.context.diagnostics;

		const codeActions: CodeAction[] = [];

		for (const d of diagnostics) {
			if (d.code) {
				const fix = lookupFixes(params.textDocument.uri, d);
				if (fix) {
					codeActions.push(fix);
				}
			}
		}

		return codeActions;
	});

	function lookupFixes(docUri: DocumentUri, diagnostic: Diagnostic): CodeAction | undefined {
		// If doc doesnt exist, we can exit now.
		const doc = documents.get(docUri);
		if (!doc) {
			return;
		}

		switch (diagnostic.code) {
			case errors.ValidationError.MissingDefinition:
				// Indent configurable, but set to 2 spaces for now
				return getMissingDefinitionFix({ docUri, diagnostic }, "  ",
					getLineContent(docUri, diagnostic.range.start.line) || "");
			case errors.ValidationError.DuplicatedError:
				return getDuplicationFix({ docUri, diagnostic });
			case errors.ValidationError.ReservedTypeKeywords:
				return getReservedTypeNameFix({ docUri, diagnostic });
			default:
				return undefined;
		}
	}

	function getLineContent(doc: DocumentUri, line: number): string | undefined {
		return documents.get(doc)?.getText().split("\n")[line];
	}

	connection.onHover((params: HoverParams): Hover | undefined => {
		const doc = documents.get(params.textDocument.uri);

		if (doc === undefined) {
			return;
		}

		const range = getRangeOfWord(doc, params.position);
		const symbol = doc.getText(range);
		const docSummary = defaultDocumentationMap[symbol];

		if (!docSummary) {
			return;
		}

		const contents: MarkupContent = {
			kind: MarkupKind.Markdown,
			value: `**${symbol}**  \n${docSummary.summary}  \n[Link to documentation](${docSummary.link}])`,
		};
		return {
			contents,
			range
		};
	});

	function getRangeOfWord(document: TextDocument, position: Position): Range {
		const text = document.getText();

		let pointerStart = document.offsetAt(position);
		let pointerEnd = document.offsetAt(position);

		while (text.charAt(pointerStart).match(/\w/)) {
			pointerStart--;
		}

		while (text.charAt(pointerEnd).match(/\w/)) {
			pointerEnd++;
		}

		let start = document.positionAt(pointerStart + 1);
		let end = document.positionAt(pointerEnd);

		if (document.getText({ start, end }) === "but" &&
			// If we've hovered "but", track forward and check if there is a matching "not"
			document.getText({ start, end: document.positionAt(pointerEnd + 4) }) === "but not") {
			end = document.positionAt(pointerEnd + 4);
		} else if (document.getText({ start, end }) === "not" &&
			// If we've hovered "not", track backward and check if there is a matching "but"
			document.getText({ start: document.positionAt(pointerStart - 3), end }) === "but not") {
			start = document.positionAt(pointerStart - 3);
		}

		return { start, end };
	}

	connection.onDidChangeWatchedFiles(_change => {
		// Monitored files have change in VSCode
		console.log("We received an file change event");
	});

	// This handler provides the initial list of the completion items.
	connection.onCompletion(
		(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
			// The pass parameter contains the position of the text document in
			// which code complete got requested. For the example we ignore this
			// info and always provide the same completion items.
			return [];
		}
	);

	// Make the text document manager listen on the connection
	// for open, change and close text document events
	documents.listen(connection);

	// Listen on the connection
	connection.listen();

}