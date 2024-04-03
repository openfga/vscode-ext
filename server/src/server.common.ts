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

import { errors, transformer, validator } from "@openfga/syntax-transformer";

import { defaultDocumentationMap } from "./documentation";
import { getDuplicationFix, getMissingDefinitionFix, getReservedTypeNameFix } from "./code-action";
import { LineCounter, YAMLSeq, isScalar, parseDocument, visitAsync, Document } from "yaml";
import {
  YAMLSourceMap,
  YamlStoreValidateResults,
  getTooManyTuplesException,
  rangeFromLinePos,
  validateYamlStore,
  getFieldPosition,
  getRangeFromToken,
} from "./yaml-utils";
import { getRangeOfWord } from "./helpers";
import { createDiagnostics } from "./dsl-utils";
import { URI } from "vscode-uri";

import { clientUtils } from "./client-utils";
import { AuthorizationModel } from "@openfga/sdk";

export function startServer(connection: _Connection) {
  console.log = connection.console.log.bind(connection.console);
  console.error = connection.console.error.bind(connection.console);

  // Create a simple text document manager.
  const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

  // Create utility tool for calls back to the vscode client
  const clientRequests = clientUtils(connection, documents);

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

  // Validate YAML store file
  async function validateYamlSyntaxAndModel(textDocument: TextDocument): Promise<YamlStoreValidateResults> {
    const lineCounter = new LineCounter();
    const yamlDoc = parseDocument(textDocument.getText(), {
      lineCounter,
      keepSourceTokens: true,
    });

    // Dont validate if a document contains over a 1000 tuples.
    if (yamlDoc.has("tuples") && (yamlDoc.get("tuples") as YAMLSeq)?.items?.length > 1000) {
      const location = (yamlDoc.get("tuples") as YAMLSeq).range;
      if (location !== null && location !== undefined) {
        return { diagnostics: [getTooManyTuplesException(location, textDocument)] };
      }
      console.error("Tuple limit of 1,000 has been reached. Validation is disabled.");
    }

    const diagnostics: Diagnostic[] = [];
    const modelDiagnostics: Diagnostic[] = [];

    // Basic syntax errors
    for (const err of yamlDoc.errors) {
      diagnostics.push({ message: err.message, range: rangeFromLinePos(err.linePos) });
    }

    await visitAsync(yamlDoc, {
      async Pair(_, pair) {
        if (pair.key && isScalar(pair.key) && pair.key.value === "tuple_file" && isScalar(pair.value)) {
          const fileName = pair.value;
          try {
            await clientRequests.getFileContents(URI.parse(textDocument.uri), fileName.value as string);
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

    const map = new YAMLSourceMap();
    map.doMap(yamlDoc.contents);

    let model,
      modelUri = undefined;

    try {
      // Parse model field
      if (yamlDoc.has("model")) {
        diagnostics.push(...(await parseYamlModel(yamlDoc, lineCounter)));
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
        modelDiagnostics.push(...(await getDiagnosticsForDsl(model)));
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

  // Check for `model` field, and get diagnsotics
  async function parseYamlModel(yamlDoc: Document, lineCounter: LineCounter): Promise<Diagnostic[]> {
    const position = getFieldPosition(yamlDoc, lineCounter, "model");

    // Given model value occurs on the subseqnet line, and at an indent of 2 spaces, we need to compensate
    // by shifting the position of diagnostics to properly align with the model text
    let dslDiagnostics = await getDiagnosticsForDsl(yamlDoc.get("model") as string);
    dslDiagnostics = dslDiagnostics.map((d) => {
      const r = d.range;
      r.start.line += position.line;
      r.start.character += 2;
      r.end.line += position.line;
      r.end.character += 2;
      return d;
    });
    return dslDiagnostics;
  }

  // Retrieve external model file
  async function parseExternalModelFile(modelUri: URI, modelFile: string): Promise<[model: string, modelUri: URI]> {
    // Attempt to get file contents, return error otherwise
    const result = await clientRequests.getFileContents(modelUri, modelFile);
    const path = URI.parse(modelFile).path;

    // If model file doesnt match expected extension
    if (path.match(/.*\.json$/)) {
      result.contents = transformer.transformJSONStringToDSL(result.contents);
    } else if (path.match(/fga.mod$/)) {
      const authModel = await validateFgaMod(result.contents, result.uri.path);

      if (authModel.dsl) {
        result.contents = transformer.transformJSONToDSL(authModel.dsl);
      }
    }
    return [result.contents, result.uri];
  }

  // Parse and validate DSL, whether it is a regular or modular model file
  async function getDiagnosticsForDsl(dsl: string, uri?: string): Promise<Diagnostic[]> {
    try {
      const transform = transformer.transformDSLToJSONObject(dsl);
      if (transform.schema_version) {
        // If regular module
        validator.validateDSL(dsl);
      } else if (uri) {
        // If a modular model & has a URI, validate against the fga.mod file
        // Get the closest fga.mod files
        const fgaModFile = await clientRequests.getFileUp(URI.parse(uri), "fga.mod");
        if (fgaModFile?.contents && fgaModFile.uri) {
          // Get path from URI to match diagnostics
          const modFilePath = fgaModFile.uri.path;
          const filePath = URI.parse(uri).path.replace(modFilePath.substring(0, modFilePath.lastIndexOf("/") + 1), "");
          // Return only diagnostics that match the models file path
          return (await validateFgaMod(fgaModFile.contents, modFilePath)).diagnostics.filter((d) => {
            return d.data.file === filePath;
          });
        }
      }
    } catch (err) {
      if (err instanceof errors.BaseMultiError) {
        return createDiagnostics(err);
      } else {
        console.error("Unhandled Exception: " + err);
      }
    }
    return [];
  }

  // Validate a given fga.mod
  async function validateFgaMod(
    text: string,
    uri: string,
  ): Promise<{
    diagnostics: Diagnostic[];
    dsl: Omit<AuthorizationModel, "id"> | undefined;
    modfile: transformer.ModFile | undefined;
  }> {
    const diagnostics: Diagnostic[] = [];
    let yamlDoc: transformer.ModFile;

    try {
      yamlDoc = transformer.transformModFileToJSON(text);
    } catch (err: any) {
      return {
        modfile: undefined,
        dsl: undefined,
        diagnostics: createDiagnostics(err),
      };
    }

    const files: transformer.ModuleFile[] = [];

    for (const file in yamlDoc.contents.value) {
      const fileValue = yamlDoc.contents.value[file];
      try {
        files.push({
          name: fileValue.value,
          contents: (await clientRequests.getFileContents(URI.parse(uri), fileValue.value)).contents,
        });
      } catch (err: any) {
        diagnostics.push({
          message: `unable to retrieve contents of \`${fileValue.value}\`; ${err.message}`,
          range: {
            start: { line: fileValue.line.start, character: fileValue.column.start },
            end: { line: fileValue.line.end, character: fileValue.column.end },
          },
        });
      }
    }

    if (diagnostics.length) {
      return { modfile: yamlDoc, dsl: undefined, diagnostics };
    }

    try {
      const dsl = transformer.transformModuleFilesToModel(files, yamlDoc.schema.value);

      return { modfile: yamlDoc, dsl: dsl, diagnostics: [] };
    } catch (err: any) {
      return { modfile: yamlDoc, dsl: undefined, diagnostics: [...createDiagnostics(err)] };
    }
  }

  // Respond to request for diagnostics from server
  connection.languages.diagnostics.on(async (params: DocumentDiagnosticParams): Promise<DocumentDiagnosticReport> => {
    try {
      const doc = documents.get(params.textDocument.uri);

      if (!doc) {
        return { items: [], kind: "full" };
      }

      const docName = doc.uri.substring(doc.uri.lastIndexOf("/") + 1);

      if (docName.match("^fga.mod$")) {
        const { modfile, diagnostics } = await validateFgaMod(doc.getText(), doc.uri);

        if (modfile) {
          const fgaDiagnostics: Diagnostic[] = [];

          fgaDiagnostics.push(
            ...diagnostics.filter((diagnostic) => {
              return !(diagnostic.data && diagnostic.data.file);
            }),
          );

          // Map errors from module files to fga manifest
          fgaDiagnostics.push(
            ...diagnostics
              .filter((diagnostic) => {
                return diagnostic.data && diagnostic.data.file;
              })
              .map((diagnostic) => {
                for (const f of modfile?.contents.value || {}) {
                  if (diagnostic?.data?.file === f.value) {
                    diagnostic.message = `error in ${diagnostic.data.file}: ${diagnostic.message}`;
                    diagnostic.range.start.line = f.line.start;
                    diagnostic.range.start.character = f.column.start;
                    diagnostic.range.end.line = f.line.end;
                    diagnostic.range.end.character = f.column.end;
                    return diagnostic;
                  }
                }
                return diagnostic;
              }),
          );

          return { items: fgaDiagnostics, kind: "full" };
        } else {
          return { items: diagnostics, kind: "full" };
        }
      }

      if (docName.match(".(fga|openfga)$")) {
        return { items: await getDiagnosticsForDsl(doc.getText(), doc.uri), kind: "full" };
      }

      if (docName.match(".(fga.yaml|openfga.yaml)$")) {
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
