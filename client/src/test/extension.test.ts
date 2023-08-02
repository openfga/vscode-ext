

import * as fs from 'fs';
import assert = require('assert');
import { TextDocument, commands, window } from 'vscode';
import { getDocUri, activate } from './helper';
import { friendlySyntaxToApiSyntax } from '@openfga/syntax-transformer';


suite('Should execute command', () => {

	const docUri = getDocUri('test.fga');

	test('Generates expected JSON', async () => {

		await activate(docUri);

		// Get editor window
		const editor = await window.showTextDocument(docUri);

		// Get result from running command against what is in editor window
		const resultFromCommand = await commands.executeCommand<TextDocument>('openfga.commands.transformToJson');

		// Get original document
		const original = fs.readFileSync(getDocUri('test.fga').fsPath);

		// Call transform directly for comparison, using original doc
		const resultFromMethodCall = JSON.stringify(friendlySyntaxToApiSyntax(original.toString()), null, "  ");

		// Ensure result from command is the same as result from method.
		assert.equal(editor.document.getText(), original);
		assert.equal(resultFromCommand.getText(), resultFromMethodCall);
	});

});