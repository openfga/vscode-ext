import {
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  InitializeParams,
  TextDocumentSyncKind,
  InitializeResult,
  _Connection,
  HoverParams,
  Hover,
  MarkupContent,
  MarkupKind,
  CodeActionParams,
  CodeAction,
  DocumentUri,
} from "vscode-languageserver";

import { TextDocument } from "vscode-languageserver-textdocument";

import { validator, errors, transformer } from "@openfga/syntax-transformer";

import { defaultDocumentationMap } from "./documentation";
import { getDuplicationFix, getMissingDefinitionFix, getReservedTypeNameFix } from "./code-action";
import { LineCounter, Node, YAMLSeq, parseDocument } from "yaml";
import { BlockMap, SourceToken } from "yaml/dist/parse/cst";
import { YAMLSourceMap, rangeFromLinePos } from "./yaml-utils";
import { ErrorObject, ValidateFunction } from "ajv";
import { YamlStoreValidator } from "./openfga-yaml-schema";
import { getRangeOfWord } from "./helpers";

export function startServer(connection: _Connection) {
  console.log = connection.console.log.bind(connection.console);
  console.error = connection.console.error.bind(connection.console);

  // Create a simple text document manager.
  const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

  let hasConfigurationCapability = false;
  let hasWorkspaceFolderCapability = false;
  let hasDiagnosticRelatedInformationCapability = false;

  const schemaValidator: ValidateFunction = YamlStoreValidator();

  connection.onInitialize((params: InitializeParams) => {
    console.log("Initialize openfga language server");

    const capabilities = params.capabilities;

    // Does the client support the `workspace/configuration` request?
    // If not, we fall back using global settings.
    hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
    hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
    hasDiagnosticRelatedInformationCapability = !!(
      capabilities.textDocument &&
      capabilities.textDocument.publishDiagnostics &&
      capabilities.textDocument.publishDiagnostics.relatedInformation
    );

    const result: InitializeResult = {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Incremental,
        hoverProvider: true,
        codeActionProvider: true,
      },
    };
    if (hasWorkspaceFolderCapability) {
      result.capabilities.workspace = {
        workspaceFolders: {
          supported: true,
        },
      };
    }

    console.log("hasConfigurationCapability: " + hasConfigurationCapability);
    console.log("hasWorkspaceFolderCapability: " + hasWorkspaceFolderCapability);
    console.log("hasDiagnosticRelatedInformationCapability: " + hasDiagnosticRelatedInformationCapability);

    return result;
  });

  connection.onInitialized(() => {});

  connection.onDidChangeConfiguration(() => {
    // Revalidate all open text documents
    documents.all().forEach(validateTextDocument);
  });

  // The content of a text document has changed. This event is emitted
  // when the text document first opened or when its content has changed.
  documents.onDidChangeContent((change) => {
    validateTextDocument(change.document);
  });

  documents.onDidClose((change) => {
    connection.sendDiagnostics({
      uri: change.document.uri,
      diagnostics: [],
    });
  });

  const createDiagnostics = (err: errors.DSLSyntaxError | errors.ModelValidationError): Diagnostic[] => {
    return (
      err.errors.map((e: errors.DSLSyntaxSingleError | errors.ModelValidationSingleError) => {
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
      }) || []
    );
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

  function validateYamlSyntaxAndModel(textDocument: TextDocument): void {
    connection.sendDiagnostics({
      uri: textDocument.uri,
      diagnostics: [],
    });
    const diagnostics: Diagnostic[] = [];

    const lineCounter = new LineCounter();
    const yamlDoc = parseDocument(textDocument.getText(), {
      lineCounter,
      keepSourceTokens: true,
    });

    const map = new YAMLSourceMap();
    map.doMap(yamlDoc.contents);

    // Dont validate if a document contains over a 1000 tuples.
    if (yamlDoc.has("tuples") && (yamlDoc.get("tuples") as YAMLSeq).items.length > 1000) {

      let start = { line: 0, character: 0 };
      let end = { line: 0, character: 0 };

      const range = map.nodes.get("tuples");
      if (range) {
        start = textDocument.positionAt(range?.[0]);
        end = textDocument.positionAt(range?.[1]);
      }

      diagnostics.push({
        message: "Tuple limit of 1,000 has been reached. Validation is disabled.",
        severity: DiagnosticSeverity.Warning,
        range: { start, end },
      });

      connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
      return;
    }

    // Basic syntax errors
    for (const err of yamlDoc.errors) {
      diagnostics.push({ message: err.message, range: rangeFromLinePos(err.linePos) });
    }

    if (yamlDoc.has("model")) {
      let position: { line: number; col: number };

      // Get the model token and find its position
      (yamlDoc.contents?.srcToken as BlockMap).items.forEach((i) => {
        if (i.key?.offset !== undefined && (i.key as SourceToken).source === "model") {
          position = lineCounter.linePos(i.key?.offset);
        }
      });

      // Shift generated diagnostics by line of model, and indent of 2
      let dslDiagnostics = getDiagnosticsForDsl(yamlDoc.get("model") as string);
      dslDiagnostics = dslDiagnostics.map((d) => {
        const r = d.range;
        r.start.line += position.line;
        r.start.character += 2;
        r.end.line += position.line;
        r.end.character += 2;
        return d;
      });
      diagnostics.push(...dslDiagnostics);
    }

    try {
      const jsonModel = transformer.transformDSLToJSONObject(yamlDoc.get("model") as string);

      if (jsonModel && !schemaValidator.call({ jsonModel }, yamlDoc.toJSON())) {
        schemaValidator.errors?.forEach((e: ErrorObject) => {
          let start = { line: 0, character: 0 };
          let end = { line: 0, character: 0 };
          let message;
          let severity: DiagnosticSeverity = DiagnosticSeverity.Error;

          if (e.keyword === "valid_store_warning") {
            severity = DiagnosticSeverity.Warning;
            const key = e.instancePath.substring(1).replace(/\//g, ".");
            const range = map.nodes.get(key);
            if (range) {
              start = textDocument.positionAt(range?.[0]);
              end = textDocument.positionAt(range?.[1]);
            }
            message = "warning: " + e.message;
          } else if (e.keyword === "additionalProperties") {
            // If we've got invalid keys, mark them
            let key = e.params["additionalProperty"];
            if (e.instancePath) {
              const path = e.instancePath.substring(1).replace(/\//g, ".");
              key = path.concat(".", key);
            }
            const range = map.nodes.get(key);
            if (range) {
              start = textDocument.positionAt(range?.[0]);
              end = textDocument.positionAt(range?.[1]);
            }
            message = key + " is not a recognized key.";
          } else if (e.keyword === "required" || e.keyword === "valid_tuple") {
            const key = e.instancePath.substring(1).split("/");
            let range;
            if (/^\d+$/.test(key[key.length - 1])) {
              // We have an array if the key is a number
              const value = yamlDoc.getIn(key);
              range = (value as Node).range;
            } else {
              range = map.nodes.get(key.join("."));
            }
            if (range) {
              start = textDocument.positionAt(range?.[0]);
              end = textDocument.positionAt(range?.[1]);
            }
            message = key.join(".") + " " + e.message;
          } else {
            // All other schema errors
            const key = e.instancePath.substring(1).replace(/\//g, ".");
            const range = map.nodes.get(key);
            if (range) {
              start = textDocument.positionAt(range?.[0]);
              end = textDocument.positionAt(range?.[1]);
            }
            message = key + " " + e.message;
          }
          diagnostics.push({ message: message, range: { start, end }, severity });
        });
      }
    } catch (err) {
      console.error("Failed validator:" + err);
    } finally {
      connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
    }
  }

  function validateTextDocument(textDocument: TextDocument): void {
    if (textDocument.languageId === "openfga") {
      validateDSL(textDocument);
    } else if (textDocument.languageId === "yaml-store-openfga") {
      validateYamlSyntaxAndModel(textDocument);
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
        return getMissingDefinitionFix(
          { docUri, diagnostic },
          "  ",
          getLineContent(docUri, diagnostic.range.start.line) || "",
        );
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
      range,
    };
  });

  // Make the text document manager listen on the connection
  // for open, change and close text document events
  documents.listen(connection);

  // Listen on the connection
  connection.listen();
}
