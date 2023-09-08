import * as vscode from 'vscode';
import * as assert from 'assert';
import { getDocUri, activate } from './helper';

suite('Should get diagnostics', () => {
	const docUri = getDocUri('diagnostics.openfga');

	test('Diagnoses uppercase texts', async () => {
		await testDiagnostics(docUri, [
			{ message: '`user` is not a valid type.', range: toRange(5, 20, 5, 24), severity: vscode.DiagnosticSeverity.Error, source: 'ModelValidationError' },
			{ message: '`user` is not a valid type.', range: toRange(8, 19, 8, 23), severity: vscode.DiagnosticSeverity.Error, source: 'ModelValidationError' },
			{ message: '`user` is not a valid type.', range: toRange(9, 19, 9, 23), severity: vscode.DiagnosticSeverity.Error, source: 'ModelValidationError' },
			{ message: '`user` is not a valid type.', range: toRange(10, 24, 10, 28), severity: vscode.DiagnosticSeverity.Error, source: 'ModelValidationError' },
			{ message: '`member` is not a valid relation for `organization`.', range: toRange(10, 29, 10, 48), severity: vscode.DiagnosticSeverity.Error, source: 'ModelValidationError' },
			{ message: '`user` is not a valid type.', range: toRange(11, 25, 11, 29), severity: vscode.DiagnosticSeverity.Error, source: 'ModelValidationError' },
			{ message: '`member` is not a valid relation for `organization`.', range: toRange(11, 30, 11, 49), severity: vscode.DiagnosticSeverity.Error, source: 'ModelValidationError' },
			{ message: '`user` is not a valid type.', range: toRange(12, 25, 12, 29), severity: vscode.DiagnosticSeverity.Error, source: 'ModelValidationError' },
			{ message: '`member` is not a valid relation for `organization`.', range: toRange(12, 30, 12, 49), severity: vscode.DiagnosticSeverity.Error, source: 'ModelValidationError' },
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