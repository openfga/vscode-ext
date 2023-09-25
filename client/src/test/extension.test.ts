

import * as assert from 'assert';
import { TextDocument, Uri, commands, window, workspace } from 'vscode';
import { getDocUri, activate } from './helper';
import { transformer } from '@openfga/syntax-transformer';


suite('Should execute command', () => {

	const docUri = getDocUri('test.fga');

	test('Generates expected JSON', async () => {

		await activate(docUri);

		// Get editor window
		const editor = await window.showTextDocument(docUri);

		// Get result from running command against what is in editor window
		const resultFromCommand = await commands.executeCommand<TextDocument>('openfga.commands.transformToJson');

		// Get original document

		const original = await workspace.fs.readFile(getDocUri('test.fga'));

		// Call transform directly for comparison, using original doc
		const resultFromMethodCall = JSON.stringify(transformer.transformDSLToJSON(original.toString()), null, "  ");

		// Ensure result from command is the same as result from method.
		assert.equal(editor.document.getText(), original);
		assert.equal(resultFromCommand.getText(), resultFromMethodCall);
	});

});