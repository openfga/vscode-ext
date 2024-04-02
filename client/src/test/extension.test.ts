import * as assert from "assert";
// eslint-disable-next-line import/no-unresolved
import { TextDocument, commands, window, workspace } from "vscode";
import { getDocUri, activate } from "./helper";
import { transformer } from "@openfga/syntax-transformer";

suite("Should execute command", () => {
  test("Generates expected JSON", async () => {
    const docUri = getDocUri("test.fga");

    await activate(docUri);

    // Get editor window
    const editor = await window.showTextDocument(docUri);

    // Get result from running command against what is in editor window
    const resultFromCommand = await commands.executeCommand<TextDocument>("openfga.commands.transformToJson");

    // Get original document
    const original = String.fromCharCode.apply(null, await workspace.fs.readFile(getDocUri("test.fga")));

    // Call transform directly for comparison, using original doc
    const resultFromMethodCall = JSON.stringify(transformer.transformDSLToJSONObject(original), null, "  ");

    // Ensure result from command is the same as result from method.
    assert.equal(editor.document.getText(), original);
    assert.equal(resultFromCommand.getText(), resultFromMethodCall);
  });

  test("Generates expected JSON from modular model", async () => {
    const docUri = getDocUri("modular-models/model/core.fga");

    await activate(docUri);

    // Get editor window
    await window.showTextDocument(docUri);

    // Get result from running command against what is in editor window
    const resultFromCommand = JSON.parse(
      (await commands.executeCommand<TextDocument>("openfga.commands.transformToJson")).getText(),
    );

    // Get original document
    const original = JSON.parse(
      String.fromCharCode.apply(null, await workspace.fs.readFile(getDocUri("modular-models/output.json"))),
    );

    // Call transform directly for comparison, using original doc
    assert.equal(JSON.stringify(resultFromCommand), JSON.stringify(original));
    assert.equal(transformer.transformJSONToDSL(resultFromCommand), transformer.transformJSONToDSL(original));
  });
});
