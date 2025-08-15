// eslint-disable-next-line import/no-unresolved
import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate } from "./helper";

suite("Should validate tuple files", () => {
  test("Validates tuple_files array with valid extensions", async () => {
    const docUri = getDocUri("tuple-files-test.fga.yaml");

    await testDiagnostics(docUri, [
      // We expect file not found errors since the files don't exist in the actual test
      {
        message: "error with external file: File not found",
        range: toRange(10, 2, 10, 13), // tuples.json
        severity: vscode.DiagnosticSeverity.Error,
        source: "ParseError",
      },
      {
        message: "error with external file: File not found", 
        range: toRange(11, 2, 11, 17), // more_tuples.yaml
        severity: vscode.DiagnosticSeverity.Error,
        source: "ParseError",
      },
      {
        message: "error with external file: File not found",
        range: toRange(12, 2, 12, 22), // additional_tuples.jsonl
        severity: vscode.DiagnosticSeverity.Error,
        source: "ParseError",
      },
      {
        message: "error with external file: File not found",
        range: toRange(13, 2, 13, 18), // extra_tuples.csv
        severity: vscode.DiagnosticSeverity.Error,
        source: "ParseError",
      },
    ]);
  });

  test("Validates tuple_file and tuple_files with invalid extensions", async () => {
    const docUri = getDocUri("invalid-extension-test.fga.yaml");

    await testDiagnostics(docUri, [
      {
        message: "tuple_file must have a supported extension (.json, .yaml, .yml, .csv, .jsonl)",
        range: toRange(8, 0, 8, 21), // invalid_tuples.txt
        severity: vscode.DiagnosticSeverity.Error,
        source: "ParseError",
      },
      {
        message: "tuple_files entries must have a supported extension (.json, .yaml, .yml, .csv, .jsonl)",
        range: toRange(11, 2, 11, 19), // invalid_tuples.xyz
        severity: vscode.DiagnosticSeverity.Error,
        source: "ParseError",
      },
      {
        message: "tuple_file must have a supported extension (.json, .yaml, .yml, .csv, .jsonl)",
        range: toRange(14, 0, 14, 20), // test_invalid.doc
        severity: vscode.DiagnosticSeverity.Error,
        source: "ParseError",
      },
      {
        message: "tuple_files entries must have a supported extension (.json, .yaml, .yml, .csv, .jsonl)",
        range: toRange(17, 6, 17, 25), // invalid_test.unknown
        severity: vscode.DiagnosticSeverity.Error,
        source: "ParseError",
      },
    ]);
  });
});

async function testDiagnostics(docUri: vscode.Uri, expectedDiagnostics: vscode.Diagnostic[]) {
  await activate(docUri);

  const actualDiagnostics = vscode.languages.getDiagnostics(docUri);

  assert.equal(actualDiagnostics.length, expectedDiagnostics.length);

  expectedDiagnostics.forEach((expectedDiagnostic, i) => {
    const actualDiagnostic = actualDiagnostics[i];
    assert.equal(actualDiagnostic.message, expectedDiagnostic.message);
    assert.deepEqual(actualDiagnostic.range, expectedDiagnostic.range);
    assert.equal(actualDiagnostic.severity, expectedDiagnostic.severity);
    assert.equal(actualDiagnostic.source, expectedDiagnostic.source);
  });
}

function toRange(sLine: number, sChar: number, eLine: number, eChar: number) {
  const start = new vscode.Position(sLine, sChar);
  const end = new vscode.Position(eLine, eChar);
  return new vscode.Range(start, end);
}