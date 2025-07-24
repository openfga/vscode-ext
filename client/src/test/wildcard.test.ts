// eslint-disable-next-line import/no-unresolved
import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate } from "./helper";

suite("Should handle wildcard module paths", () => {
  test("Processes wildcard module paths in fga.mod file", async () => {
    const docUri = getDocUri("wildcard-models/fga.mod");

    // Since we're testing the diagnostics, we expect the wildcard fga.mod to be processed successfully
    // This means no diagnostics errors should be present for the wildcard patterns
    await testWildcardDiagnostics(docUri, []);
  });
});

async function testWildcardDiagnostics(docUri: vscode.Uri, expectedDiagnostics: vscode.Diagnostic[]) {
  await activate(docUri);

  const actualDiagnostics = vscode.languages.getDiagnostics(docUri);

  // Filter to only modfile-related errors, not individual file validation errors
  const modfileDiagnostics = actualDiagnostics.filter(d => 
    !d.message.includes("error in") && 
    !d.message.includes("is not a valid type") &&
    !d.message.includes("is not a valid relation")
  );

  assert.equal(modfileDiagnostics.length, expectedDiagnostics.length, 
    `Expected ${expectedDiagnostics.length} diagnostics but got ${modfileDiagnostics.length}. ` +
    `Actual diagnostics: ${JSON.stringify(modfileDiagnostics.map(d => d.message))}`);

  expectedDiagnostics.forEach((expectedDiagnostic, i) => {
    const actualDiagnostic = modfileDiagnostics[i];
    assert.equal(actualDiagnostic.message, expectedDiagnostic.message);
    assert.deepEqual(actualDiagnostic.range, expectedDiagnostic.range);
    assert.equal(actualDiagnostic.severity, expectedDiagnostic.severity);
    assert.equal(actualDiagnostic.source, expectedDiagnostic.source);
  });
}