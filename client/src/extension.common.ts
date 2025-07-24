import { transformer } from "@openfga/syntax-transformer";
// eslint-disable-next-line import/no-unresolved
import { window, workspace } from "vscode";
import { URI } from "vscode-uri";

export interface ReadFileFunction {
  (uri: URI, file: string, resourceConfig?: { scheme: string; authority: string | undefined }): Promise<string>;
}

export interface GlobFunction {
  (pattern: string, options?: any): Promise<string[]>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export const transformDSLCommand = async (readFile: ReadFileFunction, globFiles?: GlobFunction) => {
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
        console.error("Unable to find closest fga.mod file: " + err);
        return undefined;
      }
      fgaModUri = URI.parse(fgaModUri.path.substring(0, fgaModUri.path.lastIndexOf("/")));
    }
  }

  // Lookup all files
  try {
    const modContents = transformer.transformModFileToJSON(contents);
    const files: transformer.ModuleFile[] = [];
    
    // Extract patterns and resolve wildcards
    const patterns = modContents.contents.value.map(item => item.value);
    
    for (const pattern of patterns) {
      if (pattern.includes('*') && globFiles) {
        // Handle wildcard pattern (only if glob function is available)
        try {
          const fullPattern = pattern.startsWith("/") ? pattern : `${fgaModUri.path}/${pattern}`;
          const matchedFiles = await globFiles(fullPattern, { 
            windowsPathsNoEscape: true,
            nodir: true
          });
          
          // Convert to relative paths and read contents
          for (const matchedFile of matchedFiles) {
            // Convert absolute path to relative path from fgaModUri
            let relativePath = matchedFile;
            if (matchedFile.startsWith("/")) {
              const basePath = fgaModUri.path.endsWith("/") ? fgaModUri.path : fgaModUri.path + "/";
              relativePath = matchedFile.replace(basePath, "");
            }
            
            try {
              const content = await readFile(fgaModUri, relativePath, resourceConfig);
              files.push({
                name: relativePath,
                contents: content,
              });
            } catch (err) {
              console.error(`Error reading file ${relativePath}: ${err}`);
            }
          }
        } catch (err) {
          console.error(`Error processing wildcard pattern ${pattern}: ${err}`);
          // Fall back to treating as regular file if glob fails
          try {
            files.push({
              name: pattern,
              contents: await readFile(fgaModUri, pattern, resourceConfig),
            });
          } catch (fileErr) {
            console.error(`Error reading file ${pattern}: ${fileErr}`);
          }
        }
      } else {
        // Handle regular file path
        try {
          files.push({
            name: pattern,
            contents: await readFile(fgaModUri, pattern, resourceConfig),
          });
        } catch (err) {
          console.error(`Error reading file ${pattern}: ${err}`);
        }
      }
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
