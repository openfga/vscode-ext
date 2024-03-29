import * as path from "path";
// eslint-disable-next-line import/no-unresolved
import { window, workspace, ExtensionContext, commands, Uri } from "vscode";
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
      fileEvents: workspace.createFileSystemWatcher("**/*.{fga.yaml,fga,openfga,openfga.yaml,yaml,json,csv}"),
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

    const modelInApiFormat = transformer.transformDSLToJSONObject(text);

    const doc = await workspace.openTextDocument({
      content: JSON.stringify(modelInApiFormat, null, "  "),
      language: "json",
    });

    return (await window.showTextDocument(doc)).document;
  });

  client.onRequest("getFileContents", async (uri) => {
    return (await workspace.fs.readFile(Uri.parse(uri))).toString();
  });

  context.subscriptions.push(transformCommand);
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
