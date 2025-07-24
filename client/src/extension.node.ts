import * as path from "path";
import { glob } from "glob";
// eslint-disable-next-line import/no-unresolved
import { workspace, ExtensionContext, commands, Uri } from "vscode";

import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from "vscode-languageclient/node";

import { URI, Utils } from "vscode-uri";
import { transformDSLCommand } from "./extension.common";

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

    diagnosticPullOptions: {
      onChange: true,
    },
    documentSelector: [{ language: "openfga" }, { language: "yaml-store-openfga" }, { language: "mod-openfga" }],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher(
        "**/?(fga.mod|*.{fga.yaml,fga,openfga,openfga.yaml,yaml,json,csv})",
      ),
    },
  };

  // Create the language client and start the client.
  client = new LanguageClient("openfgaLanguageServer", "OpenFGA Language Server", serverOptions, clientOptions);

  // Start the client. This will also launch the server
  client.start();

  const transformCommand = commands.registerCommand("openfga.commands.transformToJson", async () =>
    transformDSLCommand(
      async (uri: URI, file: string, resourceConfig: { scheme: string; authority: string | undefined }) => {
        return (await workspace.fs.readFile(Utils.joinPath(uri, file).with(resourceConfig))).toString();
      },
      async (pattern: string, options?: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        return await glob(pattern, options);
      }
    ),
  );

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
