// eslint-disable-next-line import/no-unresolved
import { ExtensionContext, Uri, commands, workspace } from "vscode";
import { LanguageClientOptions } from "vscode-languageclient";

import { LanguageClient } from "vscode-languageclient/browser";

import { URI, Utils } from "vscode-uri";
import { transformDSLCommand } from "./extension.common";

let client: LanguageClient;

// Explination for working with a virtual file system:
// https://github.com/microsoft/vscode/wiki/Virtual-Workspaces#review-that-the-code-is-ready-for-virtual-resources

// this method is called when vs code is activated
export function activate(context: ExtensionContext) {
  // Register the server for all document types
  const documentSelector = [{ language: "openfga" }, { language: "yaml-store-openfga" }, { language: "mod-openfga" }];

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    documentSelector,
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher(
        "**/?(fga.mod|*.{fga.yaml,fga,openfga,openfga.yaml,yaml,json,csv})",
      ),
    },
    initializationOptions: {},
  };

  const client = createWorkerLanguageClient(context, clientOptions);

  client.start();

  const transformCommand = commands.registerCommand("openfga.commands.transformToJson", async () =>
    transformDSLCommand(
      async (
        uri: URI,
        file: string,
        resourceConfig: { scheme: string; authority: string | undefined },
      ): Promise<string> => {
        const fileUri = Utils.joinPath(uri, file).with(resourceConfig);
        return new TextDecoder("utf8").decode(await workspace.fs.readFile(fileUri)).toString();
      },
    ),
  );

  client.onRequest("getFileContents", async (uri) => {
    const doc = await workspace.fs.readFile(Uri.parse(uri));
    return new TextDecoder("utf8").decode(doc);
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
