import * as path from "path";
// eslint-disable-next-line import/no-unresolved
import { window, workspace, ExtensionContext, commands } from "vscode";
import { transformer } from "@openfga/syntax-transformer";

import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from "vscode-languageclient/node";

let client: LanguageClient;

export function activate(context: ExtensionContext) {
  const module = path.join(__dirname, "..", "..", "server", "out", "server.node.js");
  const debugOptions = { execArgv: ["--nolazy", "--inspect=6012"] };
  const serverOptions: ServerOptions = {
    run: { module, transport: TransportKind.ipc },
    debug: { module, transport: TransportKind.ipc, options: debugOptions },
  };

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    // Register the server for all document types
    documentSelector: [{ language: "openfga" }, { language: "yaml-store-openfga" }],
    synchronize: {
      // Notify the server about file changes to '.clientrc files contained in the workspace
      fileEvents: workspace.createFileSystemWatcher("**/.clientrc"),
    },
  };

  // Create the language client and start the client.
  client = new LanguageClient("openfgaLanguageServer", "OpenFGA Language Server", serverOptions, clientOptions);

  // Start the client. This will also launch the server
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
