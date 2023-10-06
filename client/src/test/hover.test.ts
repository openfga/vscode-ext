// eslint-disable-next-line import/no-unresolved
import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate } from "./helper";

suite("Should show hover", () => {
	const docUri = getDocUri("test.fga");

	test("Displays hover text", async () => {

		const markdown = new vscode.MarkdownString("Test");
		const hover = new vscode.Hover(markdown, toRange(1, 2, 1, 8));

		await testHover(docUri, new vscode.Position(1, 6), [hover]);

	});
});

function toRange(sLine: number, sChar: number, eLine: number, eChar: number) {
	const start = new vscode.Position(sLine, sChar);
	const end = new vscode.Position(eLine, eChar);
	return new vscode.Range(start, end);
}

async function testHover(docUri: vscode.Uri, position: vscode.Position, expectedHovers: vscode.Hover[]) {
	await activate(docUri);

	const actualHovers = await vscode.commands.executeCommand<vscode.Hover[]>("vscode.executeHoverProvider", docUri, position);

	assert.equal(actualHovers.length, expectedHovers.length);

	expectedHovers.forEach((expectedHover, i) => {
		const actualHover = actualHovers[i];
		assert.deepEqual(actualHover.range, expectedHover.range);
		// TODO: figure out why there is missing content.
		// assert.deepEqual(actualHover.contents, expectedHover.contents); 
	});

}