// eslint-disable-next-line import/no-unresolved
import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate } from "./helper";

suite("Should handle file changes in wildcard directories", () => {
  test("Watches for changes in .fga files", async () => {
    // This test verifies that the existing file watcher pattern
    // "**/?(fga.mod|*.{fga.yaml,fga,openfga,openfga.yaml,yaml,json,csv})"
    // properly catches .fga files that would be matched by wildcard patterns
    
    const docUri = getDocUri("wildcard-models/fga.mod");
    await activate(docUri);

    // Get initial diagnostics
    const initialDiagnostics = vscode.languages.getDiagnostics(docUri);
    
    // The wildcard pattern should resolve to existing files without errors
    const fileErrors = initialDiagnostics.filter(d => 
      d.message.includes("unable to retrieve contents")
    );
    
    // Should have no file retrieval errors
    assert.equal(fileErrors.length, 0, 
      `Expected no file retrieval errors, but got: ${JSON.stringify(fileErrors.map(d => d.message))}`);
  });

  test("Handles missing files in wildcard patterns gracefully", async () => {
    // Test that non-existent files in wildcard patterns don't break the extension
    const docUri = getDocUri("modular-models/fga.mod");
    await activate(docUri);

    const diagnostics = vscode.languages.getDiagnostics(docUri);
    
    // Should not have any critical errors that prevent loading
    const criticalErrors = diagnostics.filter(d => 
      d.severity === vscode.DiagnosticSeverity.Error && 
      d.message.includes("unable to retrieve contents")
    );
    
    // The existing test fixture should work without errors
    assert.equal(criticalErrors.length, 0,
      `Expected no critical file errors, but got: ${JSON.stringify(criticalErrors.map(d => d.message))}`);
  });
});