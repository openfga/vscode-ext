/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  InitializeResult,
  Hover,
  MarkupContent,
  TextDocumentEdit,
  CodeAction,
  Command,
  CodeActionKind,
} from "vscode-languageserver/node";
import * as VsCodeLanguageServer from "vscode-languageserver/node";
import { checkDSL } from "@openfga/syntax-transformer";
import { Marker } from "@openfga/syntax-transformer/dist/validator/reporters";
import { provideCompletionItemsOneDotOne } from "@openfga/syntax-transformer/dist/syntax-highlighters/vscode/providers/completion";
import { providerHover } from "@openfga/syntax-transformer/dist/syntax-highlighters/vscode/providers/hover-actions";
import { friendlySyntaxToApiSyntax } from "@openfga/syntax-transformer";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  ITextModel,
  VsCodeEditorType,
  Position as STPosition,
} from "@openfga/syntax-transformer/dist/syntax-highlighters/vscode/vscode.types";

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
        resolveProvider: true,
      },
      codeActionProvider: true,
      executeCommandProvider: {
        commands: [
          // 'openfga.commands.transformToJson'
        ],
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
  return result;
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(
      DidChangeConfigurationNotification.type,
      undefined
    );
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders((_event) => {
      connection.console.log("Workspace folder change event received.");
    });
  }
});

// The example settings
interface OpenFgaLspSettings {
  maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: OpenFgaLspSettings = { maxNumberOfProblems: 1000 };
let globalSettings: OpenFgaLspSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<OpenFgaLspSettings>> = new Map();

connection.onDidChangeConfiguration((change) => {
  if (hasConfigurationCapability) {
    // Reset all cached document settings
    documentSettings.clear();
  } else {
    globalSettings = <OpenFgaLspSettings>(
      (change.settings.languageServerExample || defaultSettings)
    );
  }

  // Revalidate all open text documents
  documents.all().forEach(validateContent);
});

function getDocumentSettings(resource: string): Thenable<OpenFgaLspSettings> {
  if (!hasConfigurationCapability) {
    return Promise.resolve(globalSettings);
  }
  let result = documentSettings.get(resource);
  if (!result) {
    result = connection.workspace.getConfiguration({
      scopeUri: resource,
      section: "languageServerExample",
    });
    documentSettings.set(resource, result);
  }
  return result;
}

// Only keep settings for open documents
documents.onDidClose((e) => {
  documentSettings.delete(e.document.uri);
});

documents.onDidOpen((event) => {
  validateContent(event.document);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
  validateContent(change.document);
});

async function validateContent(textDocument: TextDocument): Promise<void> {
  // return connection.sendDiagnostics({ uri: textDocument.uri,
  // 	version: textDocument.version, diagnostics: [] });
  // In this simple example we get the settings for every validate run.
  const settings = await getDocumentSettings(textDocument.uri);

  const text = textDocument.getText();

  const diagnostics: Diagnostic[] = [];
  const markers = checkDSL(text);

  for (const marker of markers) {
    try {
      const diagnostic = Diagnostic.create(
        VsCodeLanguageServer.Range.create(
          marker.startLineNumber - 1,
          marker.startColumn - 1,
          marker.endLineNumber - 1,
          marker.endColumn - 1
        ),
        marker.message,
        DiagnosticSeverity.Error,
      );
  
      diagnostic.source = marker.source;
      if (hasDiagnosticRelatedInformationCapability) {
        diagnostic.relatedInformation = [
          {
            location: {
              uri: textDocument.uri,
              range: Object.assign({}, diagnostic.range),
            },
            message: marker.message,
          },
        ];
      }
      diagnostics.push(diagnostic);

    } catch (err) { /* empty */}
  }

  // Send the computed diagnostics to VSCode.
  connection.sendDiagnostics({
    uri: textDocument.uri,
    version: textDocument.version,
    diagnostics,
  });
}

connection.onDidChangeWatchedFiles((_change) => {
  // Monitored files have change in VSCode
  connection.console.log("We received an file change event");
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
  (textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    const document = documents.get(textDocumentPosition.textDocument.uri);
    if (!document) {
      return [];
    }
    // The pass parameter contains the position of the text document in
    // which code complete got requested. For the example we ignore this
    // info and always provide the same completion items.
    const completionProvider = provideCompletionItemsOneDotOne(
      VsCodeLanguageServer,
      {}
    );
    const { items } = completionProvider(
      document,
      textDocumentPosition.position
    );
    return items;
  }
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  return item;
});

connection.onHover((params: TextDocumentPositionParams): Hover | undefined => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return undefined;
  }
  return providerHover(VsCodeLanguageServer as any, {})(
    document,
    params.position
  );
});

connection.onCodeAction((params) => {
  const textDocument = documents.get(params.textDocument.uri);
  if (textDocument === undefined) {
    return undefined;
  }
  const title = "OpenFGA: Transform DSL to JSON";
  return [
    CodeAction.create(
      title,
      Command.create(
        title,
        "openfga.commands.transformToJson",
        textDocument.uri
      ),
      CodeActionKind.RefactorRewrite
    ),
  ];
});

connection.onExecuteCommand(async (params) => {
  return;
  // if (params.command !== 'openfga.commands.transformToJson' || params.arguments ===  undefined) {
  // 	return;
  // }

  // const textDocument = documents.get(params.arguments[0]);
  // if (textDocument === undefined) {
  // 	return;
  // }
  // const text = textDocument.getText();

  // const modelInApiFormat = friendlySyntaxToApiSyntax(text);
  // connection.workspace.applyEdit({
  // 	documentChanges: [
  // 		TextDocumentEdit.create({ uri: textDocument.uri, version: textDocument.version }, [
  // 			VsCodeLanguageServer.TextEdit.replace(VsCodeLanguageServer.Range.create(0, 0, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER), JSON.stringify(modelInApiFormat, null, "  "))
  // 		])
  // 	]
  // });
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
