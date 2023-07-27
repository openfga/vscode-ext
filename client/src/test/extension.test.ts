
import { join } from 'path';
import * as fs from 'fs'
import assert = require('assert');
import { activate } from '../extension';
import { ExtensionContext, TextDocument, commands, window, workspace } from 'vscode';
import { getDocUri } from './helper';


suite('Should execute command', () => {

	test('Generates expected javascript', async () => {
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
		}

		// Attempt to activate context
		activate(context);
		
		// Assert command assigned assigned for disposal
		assert.equal(context.subscriptions.length, 1)

		const docUri = getDocUri('test.fga');
		
		await window.showTextDocument(docUri);

		const result = await commands.executeCommand<TextDocument>('openfga.commands.transformToJson')
		
		const testBuf = fs.readFileSync(getDocUri('expectedOutput/test.json').fsPath);

		// Trim out whitespace and compare fixtures to ensure consistent generation
		assert.equal(JSON.stringify(JSON.parse(result.getText())), JSON.stringify(JSON.parse(testBuf.toString())))
	});

});