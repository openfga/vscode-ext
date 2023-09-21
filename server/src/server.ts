
import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

import { validator, errors } from '@openfga/syntax-transformer';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
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
			}
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});


connection.onDidChangeConfiguration(change => {
	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});


// Only keep settings for open documents
// documents.onDidClose(e => {
// 	documentSettings.delete(e.document.uri);
// });

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

const createDiagnostics = (err: errors.DSLSyntaxError | errors.ModelValidationError): Diagnostic[] => {
	return err.errors.map((e: errors.DSLSyntaxSingleError | errors.ModelValidationSingleError)  => {
		const lines = e.getLine(-1);
		let characters;
		let source;

		if (e instanceof errors.DSLSyntaxSingleError) {
			characters = e.getColumn();
			source = "SyntaxError";
		} else if (e instanceof errors.ModelValidationSingleError) {
			characters = e.getColumn(-1);
			source = "ModelValidationError";
		} else {
			throw new Error("Unhandled Exception: " + JSON.stringify(e, null, 4));
		}

		return {
			message: e.msg,
			severity: DiagnosticSeverity.Error,
			range: {
				start: {line: lines.start, character: characters.start},
				end: {line: lines.end, character: characters.end},
			},
			source,
		};
	}) || [];
};

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
    connection.sendDiagnostics({
		uri: textDocument.uri,
		diagnostics: [],
	});

	try {
		validator.validateDSL(textDocument.getText());
	} catch(err) {
		if (err instanceof errors.DSLSyntaxError || err instanceof errors.ModelValidationError) {
			const diagnostics = createDiagnostics(err);
			connection.sendDiagnostics({uri: textDocument.uri, diagnostics});
		} else {
			console.error("Unhandled Exception: " + err);
		}
	}
}

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
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
