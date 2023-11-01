import { transformer } from "@openfga/syntax-transformer";
// eslint-disable-next-line import/no-unresolved
import { ExtensionContext, Uri, commands, window, workspace } from "vscode";
import { LanguageClientOptions } from "vscode-languageclient";

import { LanguageClient } from "vscode-languageclient/browser";

let client: LanguageClient;

// this method is called when vs code is activated
export function activate(context: ExtensionContext) {
  // Register the server for all document types
  const documentSelector = [{ language: "openfga" }, { language: "yaml-store-openfga" }];

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    documentSelector,
    synchronize: {},
    initializationOptions: {},
  };

  const client = createWorkerLanguageClient(context, clientOptions);

  client.start();

  const transformCommand = commands.registerCommand("openfga.commands.transformToJson", async () => {
    const activeEditor = window.activeTextEditor;
    if (!activeEditor) {
      return;
    }
    const text = activeEditor.document.getText();

    const modelInApiFormat = transformer.transformDSLToJSON(text);

    const doc = await workspace.openTextDocument({
      content: JSON.stringify(modelInApiFormat, null, "  "),
      language: "json",
    });

    return (await window.showTextDocument(doc)).document;
  });

  context.subscriptions.push(transformCommand);
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}

function createWorkerLanguageClient(context: ExtensionContext, clientOptions: LanguageClientOptions) {
  // Create a worker. The worker main file implements the language server.
  const serverMain = Uri.joinPath(context.extensionUri, "server/out/server.browser.js");
  const worker = new Worker(serverMain.toString(true));

  // create the language server client to communicate with the server running in the worker
  return new LanguageClient("openfgaLanguageServer", "OpenFGA Language Server", clientOptions, worker);
}
