import { URI } from "vscode-uri";

// Fallback wildcard resolution for browser (no glob support)
export async function resolveWildcardPatterns(
  patterns: string[],
  baseUri: URI
): Promise<{ pattern: string; files: string[] }[]> {
  const results: { pattern: string; files: string[] }[] = [];
  
  for (const pattern of patterns) {
    // In browser environment, treat wildcards as regular file paths
    // This is a limitation - wildcards won't work in browser mode
    results.push({ pattern, files: [pattern] });
  }
  
  return results;
}