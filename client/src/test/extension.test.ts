
import { join } from 'path';
import * as fs from 'fs';
import assert = require('assert');
import { activate } from '../extension';
import { ExtensionContext, TextDocument, commands, window, workspace } from 'vscode';
import { getDocUri } from './helper';
import { friendlySyntaxToApiSyntax } from '@openfga/syntax-transformer';


suite('Should execute command', () => {

	test('Generates expected JSON', async () => {
		const context: ExtensionContext = {
			subscriptions: [],
			workspaceState: undefined,
			globalState: undefined,
			secrets: undefined,
			extensionUri: undefined,
			extensionPath: '',
			environmentVariableCollection: undefined,
			asAbsolutePath: function (relativePath: string): string {
				throw new Error('Function not implemented.');
			},
			storageUri: undefined,
			storagePath: '',
			globalStorageUri: undefined,
			globalStoragePath: '',
			logUri: undefined,
			logPath: '',
			extensionMode: undefined,
			extension: undefined
		};

		// Attempt to activate context
		activate(context);

		// Assert command assigned assigned for disposal
		assert.equal(context.subscriptions.length, 1);

		const docUri = getDocUri('test.fga');

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