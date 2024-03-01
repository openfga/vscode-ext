import {
  TextDocuments,
  Diagnostic,
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
  DocumentDiagnosticReport,
  DocumentDiagnosticParams,
} from "vscode-languageserver";

import { TextDocument } from "vscode-languageserver-textdocument";

//import { errors, transformer } from "/Users/daniel.jeffery/VSCodeProjects/language/pkg/js/dist/index";
import { errors, transformer } from "@openfga/syntax-transformer";
import { defaultDocumentationMap } from "./documentation";
import { getDuplicationFix, getMissingDefinitionFix, getReservedTypeNameFix } from "./code-action";
import { LineCounter, YAMLSeq, isScalar, parseDocument, visitAsync } from "yaml";
import {
  YAMLSourceMap,
  YamlStoreValidateResults,
  getTooManyTuplesException,
  parseYamlModel,
  rangeFromLinePos,
  validateYamlStore,
  getFieldPosition,
  getRangeFromToken,
} from "./yaml-utils";
import { getRangeOfWord } from "./helpers";
import { getDiagnosticsForDsl as validateDSL } from "./dsl-utils";
import { URI, Utils } from "vscode-uri";

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
        diagnosticProvider: {
          identifier: "openfga",
          documentSelector: null,
          interFileDependencies: true,
          workspaceDiagnostics: false,
        },
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

  connection.onDidChangeConfiguration(() => {
    // Revalidate all open text documents
    connection.languages.diagnostics.refresh();
  });

  connection.onDidChangeWatchedFiles(() => {
    // Revalidate all open text documents
    connection.languages.diagnostics.refresh();
  });

  async function validateYamlSyntaxAndModel(textDocument: TextDocument): Promise<YamlStoreValidateResults> {
    const diagnostics: Diagnostic[] = [];
    const modelDiagnostics: Diagnostic[] = [];

    const lineCounter = new LineCounter();
    const yamlDoc = parseDocument(textDocument.getText(), {
      lineCounter,
      keepSourceTokens: true,
    });

    const map = new YAMLSourceMap();
    map.doMap(yamlDoc.contents);

    // Dont validate if a document contains over a 1000 tuples.
    if ((yamlDoc.get("tuples") as YAMLSeq)?.items?.length > 1000) {
      diagnostics.push(getTooManyTuplesException(map, textDocument));
      return { diagnostics };
    }

    // Basic syntax errors
    for (const err of yamlDoc.errors) {
      diagnostics.push({ message: err.message, range: rangeFromLinePos(err.linePos) });
    }

    await visitAsync(yamlDoc, {
      async Pair(_, pair) {
        if (pair.key && isScalar(pair.key) && pair.key.value === "tuple_file" && isScalar(pair.value)) {
          const fileName = pair.value;
          try {
            await getFileContents(URI.parse(textDocument.uri), fileName.value as string);
          } catch (err) {
            diagnostics.push({
              range: getRangeFromToken(fileName.range, textDocument),
              message: "error with external file: " + (err as Error).message,
              source: "ParseError",
            });
          }
        }
      },
    });

    let model,
      modelUri = undefined;

    try {
      // Parse model field
      if (yamlDoc.has("model")) {
        diagnostics.push(...parseYamlModel(yamlDoc, lineCounter));
        diagnostics.push(...validateYamlStore(yamlDoc.get("model") as string, yamlDoc, textDocument, map));
      } else if (yamlDoc.has("model_file")) {
        const position = getFieldPosition(yamlDoc, lineCounter, "model_file");
        const modelFile = yamlDoc.get("model_file") as string;

        try {
          [model, modelUri] = await parseExternalModelFile(URI.parse(textDocument.uri), modelFile);
        } catch (err) {
          diagnostics.push({
            range: rangeFromLinePos([position]),
            message: "error with external file: " + (err as Error).message,
            source: "ParseError",
          });
          return { diagnostics };
        }

        // If we fail model validation, we should return before continuing YAML validation
        modelDiagnostics.push(...validateDSL(model));
        if (
          modelDiagnostics.some((diagnostic) => {
            return diagnostic.code === errors.ValidationError.InvalidSyntax;
          })
        ) {
          diagnostics.push({ range: rangeFromLinePos([position]), message: "syntax error in model_file" });
          return { diagnostics, modelUri, modelDiagnostics };
        }
        diagnostics.push(...validateYamlStore(model, yamlDoc, textDocument, map));
      }
    } catch (err: any) {
      console.error("Unhandled exception: " + err.message);
      console.error(err.stack);
    }
    return { diagnostics, modelUri, modelDiagnostics };
  }

  // Retrieve external model file
  async function parseExternalModelFile(modelUri: URI, modelFile: string): Promise<[model: string, modelUri: URI]> {
    // Attempt to get file contents, return error otherwise
    const result = await getFileContents(modelUri, modelFile);

    // If model file doesnt match expected extension
    if (URI.parse(modelFile).path.match(/.*\.json$/)) {
      result.contents = transformer.transformJSONStringToDSL(result.contents);
    }
    return [result.contents, result.uri];
  }

  // Attempt to get contents of declared file for a given uri
  async function getFileContents(originalUri: URI, fileUri: string): Promise<{ contents: string; uri: URI }> {
    const uri = Utils.resolvePath(originalUri, "..", fileUri);

    let contents = documents.get(uri.toString())?.getText() as string;
    if (!contents) {
      contents = await connection.sendRequest("getFileContents", uri.toString());
    }
    return { contents, uri };
  }

  async function validateFgaMod(textDocument: TextDocument): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];
    let yamlDoc;

    try {
      yamlDoc = transformer.transformModFileToJSON(textDocument.getText());
    } catch (err: any) {
      return err.errors.map((error: any): Diagnostic => {
        const props = error.properties;
        return {
          message: props.msg,
          range: {
            start: { line: props.line.start - 1, character: props.column.start - 1 },
            end: { line: props.line.end - 1, character: props.column.end - 1 },
          },
        };
      });
    }

    for (const file of yamlDoc.contents) {
      try {
        await getFileContents(URI.parse(textDocument.uri), file);
      } catch (err: any) {
        diagnostics.push({
          message: `unable to retrieve contents of \`${file}\`; ${err.message}`,
          range: {
            start: { line: 1, character: 0 },
            end: { line: 1, character: 0 },
          },
        });
      }
    }

    return diagnostics;
  }

  // Respond to request for diagnostics from server
  connection.languages.diagnostics.on(async (params: DocumentDiagnosticParams): Promise<DocumentDiagnosticReport> => {
    try {
      const doc = documents.get(params.textDocument.uri);

      if (!doc) {
        return { items: [], kind: "full" };
      }

      if (doc.uri.match("fga.mod$")) {
        return { items: await validateFgaMod(doc), kind: "full" };
      }

      if (doc.uri.match(".(fga|openfga)$")) {
        return { items: validateDSL(doc.getText()), kind: "full" };
      }

      if (doc.uri.match(".(fga.yaml|openfga.yaml)$")) {
        const results = await validateYamlSyntaxAndModel(doc);
        return { items: results.diagnostics, kind: "full" };
      }
    } catch (err: any) {
      console.error("Unhandled exception: " + err.message);
      console.error(err.stack);
    }
    return { items: [], kind: "full" };
  });

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
