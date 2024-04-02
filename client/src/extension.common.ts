import { transformer } from "@openfga/syntax-transformer";
// eslint-disable-next-line import/no-unresolved
import { window, workspace } from "vscode";
import { URI } from "vscode-uri";

export interface ReadFileFunction {
  (uri: URI, file: string, resourceConfig?: { scheme: string; authority: string | undefined }): Promise<string>;
}

export const transformDSLCommand = async (readFile: ReadFileFunction) => {
  const activeEditor = window.activeTextEditor;
  if (!activeEditor) {
    return;
  }
  const text = activeEditor.document.getText();
  const uri = activeEditor.document.uri;

  if (!uri.path.endsWith("/fga.mod")) {
    let modelInApiFormat;
    try {
      modelInApiFormat = transformer.transformDSLToJSONObject(text);
    } catch (err) {
      console.error("Unhandled exception: " + err);
      return;
    }

    // Regular model
    if (modelInApiFormat.schema_version) {
      return (
        await window.showTextDocument(
          await workspace.openTextDocument({
            content: JSON.stringify(modelInApiFormat, null, "  "),
            language: "json",
          }),
        )
      ).document;
    }
  }

  const resourceConfig = { scheme: uri.scheme, authority: undefined };
  if (uri.authority) {
    resourceConfig.authority = uri.authority;
  }

  // Since docuemnt is not a standalone, look for Modular model
  let fgaModUri = URI.parse(uri.path.substring(0, uri.path.lastIndexOf("/")));
  let contents = undefined;

  // Lookup
  for (;;) {
    try {
      contents = await readFile(fgaModUri, "fga.mod", resourceConfig);
      break;
    } catch (err) {
      if (fgaModUri.path === "/") {
        console.error("Unable to find closest fga.mod file.");
        return undefined;
      }
      fgaModUri = URI.parse(fgaModUri.path.substring(0, fgaModUri.path.lastIndexOf("/")));
    }
  }

  // Lookup all files
  try {
    const modContents = transformer.transformModFileToJSON(contents);
    const files: transformer.ModuleFile[] = [];
    for (const file in modContents.contents.value) {
      const fileValue = modContents.contents.value[file];
      files.push({
        name: fileValue.value,
        contents: await readFile(fgaModUri, fileValue.value, resourceConfig),
      });
    }
    const dsl = transformer.transformModuleFilesToModel(files, modContents.schema.value);
    return (
      await window.showTextDocument(
        await workspace.openTextDocument({
          content: JSON.stringify(dsl, null, "  "),
          language: "json",
        }),
      )
    ).document;
  } catch (err) {
    console.error("Unhandled exception: " + err);
  }
};
