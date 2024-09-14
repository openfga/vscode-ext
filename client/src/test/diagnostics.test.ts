import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate } from "./helper";

interface DiagnosticWithAutofix extends vscode.Diagnostic {
  autofix?: string;
}

suite("Should get diagnostics", () => {
  test("Diagnoses validation errors in an fga.yaml file using `model_file` field", async () => {
    const docUri = getDocUri("diagnostics/model-file-diagnsotic.openfga.yaml");

    await testDiagnostics(docUri, [
      {
        message: "tests.0.tuples.0.relation relation 'owner' is not a relation on type 'folder'.",
        range: toRange(14, 8, 14, 16),
        severity: vscode.DiagnosticSeverity.Error,
        source: "OpenFGAYamlValidationError",
      },
      {
        message: "tests.1.tuples.0.relation relation 'owner' is not a relation on type 'folder'.",
        range: toRange(40, 8, 40, 16),
        severity: vscode.DiagnosticSeverity.Error,
        source: "OpenFGAYamlValidationError",
      },
      {
        message: "tests.0.check.0.assertions.can_write `can_write` is not a relationship for type `folder`.",
        range: toRange(22, 10, 22, 19),
        severity: vscode.DiagnosticSeverity.Error,
        source: "OpenFGAYamlValidationError",
      },
      {
        message: "tests.0.check.0.assertions.can_share `can_share` is not a relationship for type `folder`.",
        range: toRange(23, 10, 23, 19),
        severity: vscode.DiagnosticSeverity.Error,
        source: "OpenFGAYamlValidationError",
      },
      {
        message: "tests.0.list_objects.0.assertions.can_write `can_write` is not a relationship for type `folder`.",
        range: toRange(32, 10, 32, 19),
        severity: vscode.DiagnosticSeverity.Error,
        source: "OpenFGAYamlValidationError",
      },
      {
        message: "tests.0.list_objects.0.assertions.can_share `can_share` is not a relationship for type `folder`.",
        range: toRange(35, 10, 35, 19),
        severity: vscode.DiagnosticSeverity.Error,
        source: "OpenFGAYamlValidationError",
      },
    ]);
  });

  test("Diagnoses validation errors in an fga.yaml file", async () => {
    const docUri = getDocUri("diagnostics/diagnostics.fga.yaml");

    await testDiagnostics(docUri, [
      {
        message: "the relation `owner` does not exist.",
        range: toRange(10, 29, 10, 34),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ModelValidationError",
      },
      {
        message: "the relation `owner` does not exist.",
        range: toRange(12, 23, 12, 28),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ModelValidationError",
      },
      {
        message: "tests.0.tuples.0.relation relation 'owner' is not a relation on type 'folder'.",
        range: toRange(22, 8, 22, 16),
        severity: vscode.DiagnosticSeverity.Error,
        source: "OpenFGAYamlValidationError",
      },
      {
        message: "tests.1.tuples.0.relation relation 'owner' is not a relation on type 'folder'.",
        range: toRange(48, 8, 48, 16),
        severity: vscode.DiagnosticSeverity.Error,
        source: "OpenFGAYamlValidationError",
      },
      {
        message: "tests.0.check.0.assertions.can_write `can_write` is not a relationship for type `folder`.",
        range: toRange(30, 10, 30, 19),
        severity: vscode.DiagnosticSeverity.Error,
        source: "OpenFGAYamlValidationError",
      },
      {
        message: "tests.0.check.0.assertions.can_share `can_share` is not a relationship for type `folder`.",
        range: toRange(31, 10, 31, 19),
        severity: vscode.DiagnosticSeverity.Error,
        source: "OpenFGAYamlValidationError",
      },
      {
        message: "tests.0.list_objects.0.assertions.can_write `can_write` is not a relationship for type `folder`.",
        range: toRange(40, 10, 40, 19),
        severity: vscode.DiagnosticSeverity.Error,
        source: "OpenFGAYamlValidationError",
      },
      {
        message: "tests.0.list_objects.0.assertions.can_share `can_share` is not a relationship for type `folder`.",
        range: toRange(43, 10, 43, 19),
        severity: vscode.DiagnosticSeverity.Error,
        source: "OpenFGAYamlValidationError",
      },
    ]);
  });

  test("Diagnoses validation errors in an openfga file", async () => {
    const docUri = getDocUri("diagnostics/diagnostics.openfga");

    await testDiagnostics(docUri, [
      {
        message: "`user` is not a valid type.",
        range: toRange(5, 20, 5, 24),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ModelValidationError",
      },
      {
        message: "`user` is not a valid type.",
        range: toRange(8, 19, 8, 23),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ModelValidationError",
      },
      {
        message: "`user` is not a valid type.",
        range: toRange(9, 19, 9, 23),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ModelValidationError",
      },
      {
        message: "`user` is not a valid type.",
        range: toRange(10, 24, 10, 28),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ModelValidationError",
      },
      {
        message: "`member` is not a valid relation for `organization`.",
        range: toRange(10, 29, 10, 48),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ModelValidationError",
      },
      {
        message: "`user` is not a valid type.",
        range: toRange(11, 25, 11, 29),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ModelValidationError",
      },
      {
        message: "`member` is not a valid relation for `organization`.",
        range: toRange(11, 30, 11, 49),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ModelValidationError",
      },
      {
        message: "`user` is not a valid type.",
        range: toRange(12, 25, 12, 29),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ModelValidationError",
      },
      {
        message: "`member` is not a valid relation for `organization`.",
        range: toRange(12, 30, 12, 49),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ModelValidationError",
      },
    ]);
  });

  test("Suggests autofixes for failing tests", async () => {
    const docUri = getDocUri("diagnostics/diagnostics.fga.yaml");

    await testAutofixSuggestions(docUri, [
      {
        message: "the relation `owner` does not exist.",
        range: toRange(10, 29, 10, 34),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ModelValidationError",
        autofix: "Add relation `owner` to type `folder`.",
      },
      {
        message: "the relation `owner` does not exist.",
        range: toRange(12, 23, 12, 28),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ModelValidationError",
        autofix: "Add relation `owner` to type `folder`.",
      },
      {
        message: "the relation `owner` does not exist.",
        range: toRange(14, 23, 14, 28),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ModelValidationError",
        autofix: "Add relation `owner` to type `folder`.",
      },
      {
        message: "the relation `owner` does not exist.",
        range: toRange(16, 23, 16, 28),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ModelValidationError",
        autofix: "Add relation `owner` to type `folder`.",
      },
      {
        message: "the relation `owner` does not exist.",
        range: toRange(18, 23, 18, 28),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ModelValidationError",
        autofix: "Add relation `owner` to type `folder`.",
      },
      {
        message: "the relation `owner` does not exist.",
        range: toRange(20, 23, 20, 28),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ModelValidationError",
        autofix: "Add relation `owner` to type `folder`.",
      },
      {
        message: "the relation `owner` does not exist.",
        range: toRange(22, 23, 22, 28),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ModelValidationError",
        autofix: "Add relation `owner` to type `folder`.",
      },
      {
        message: "the relation `owner` does not exist.",
        range: toRange(24, 23, 24, 28),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ModelValidationError",
        autofix: "Add relation `owner` to type `folder`.",
      },
    ]);
  });
});

function toRange(sLine: number, sChar: number, eLine: number, eChar: number) {
  const start = new vscode.Position(sLine, sChar);
  const end = new vscode.Position(eLine, eChar);
  return new vscode.Range(start, end);
}

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

async function testAutofixSuggestions(docUri: vscode.Uri, expectedDiagnostics: DiagnosticWithAutofix[]) {
  await activate(docUri);

  // Wait for diagnostics to be calculated
  await new Promise(resolve => setTimeout(resolve, 1000));

  const actualDiagnostics = vscode.languages.getDiagnostics(docUri);

  assert.equal(actualDiagnostics.length, expectedDiagnostics.length);

  expectedDiagnostics.forEach((expectedDiagnostic, i) => {
    const actualDiagnostic = actualDiagnostics[i] as DiagnosticWithAutofix;
    assert.equal(actualDiagnostic.message, expectedDiagnostic.message);
    assert.deepEqual(actualDiagnostic.range, expectedDiagnostic.range);
    assert.equal(actualDiagnostic.severity, expectedDiagnostic.severity);
    assert.equal(actualDiagnostic.source, expectedDiagnostic.source);
    assert.equal(actualDiagnostic.autofix, expectedDiagnostic.autofix);
  });
}
