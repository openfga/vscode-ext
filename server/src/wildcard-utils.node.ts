import { URI } from "vscode-uri";
import { glob } from "glob";
import * as path from "path";

// Resolve wildcard patterns to actual file paths (Node.js only)
export async function resolveWildcardPatterns(
  patterns: string[],
  baseUri: URI
): Promise<{ pattern: string; files: string[] }[]> {
  const results: { pattern: string; files: string[] }[] = [];
  
  for (const pattern of patterns) {
    if (pattern.includes('*')) {
      // This is a wildcard pattern
      try {
        const basePath = path.dirname(baseUri.fsPath);
        const fullPattern = path.resolve(basePath, pattern);
        const matchedFiles = await glob(fullPattern, { 
          windowsPathsNoEscape: true,
          nodir: true // Only return files, not directories
        });
        
        // Convert absolute paths back to relative paths
        const relativeFiles = matchedFiles.map(file => 
          path.relative(basePath, file).replace(/\\/g, '/')
        );
        
        results.push({ pattern, files: relativeFiles });
      } catch (err) {
        console.error(`Error resolving wildcard pattern ${pattern}: ${err}`);
        results.push({ pattern, files: [] });
      }
    } else {
      // Regular file path, no wildcard
      results.push({ pattern, files: [pattern] });
    }
  }
  
  return results;
}