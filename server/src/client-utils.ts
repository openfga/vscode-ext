import { TextDocuments, _Connection } from "vscode-languageserver";

import { TextDocument } from "vscode-languageserver-textdocument";

import { URI, Utils } from "vscode-uri";

export const clientUtils = (connection: _Connection, documents: TextDocuments<TextDocument>) => {
  const getFileContents = async (originalUri: URI, fileUri: string): Promise<{ contents: string; uri: URI }> => {
    const uri = Utils.resolvePath(originalUri, "..", fileUri);

    let contents = documents.get(uri.toString())?.getText() as string;
    if (!contents) {
      contents = await connection.sendRequest("getFileContents", uri.toString());
    }
    return { contents, uri };
  };

  const getFileUp = async (originalUri: URI, fileName: string): Promise<{ contents: string; uri: URI } | undefined> => {
    let currentUri = originalUri;

    for (;;) {
      try {
        return await getFileContents(currentUri, fileName);
      } catch (err) {
        if (currentUri.path === "/") {
          console.error(`Unable to find ${fileName}: ${err}`);
          return undefined;
        }
        const index = currentUri.path.lastIndexOf("/");
        currentUri = URI.parse(currentUri.path.substring(0, index));
      }
    }
  };

  return { getFileContents, getFileUp };
};
