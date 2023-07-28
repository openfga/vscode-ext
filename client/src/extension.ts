/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import { window, workspace, ExtensionContext, commands, Range } from 'vscode';
import { friendlySyntaxToApiSyntax } from '@openfga/syntax-transformer';

export function activate(context: ExtensionContext) {

	const transformCommand = commands.registerCommand('openfga.commands.transformToJson', async () => {
		const activeEditor = window.activeTextEditor;
		if (!activeEditor) {
			return;
		}
		const text = activeEditor.document.getText();
		
		const modelInApiFormat = friendlySyntaxToApiSyntax(text);

		const doc = await workspace.openTextDocument({
			content: JSON.stringify(modelInApiFormat, null, "  "), 
			language: "json"
		});

		return (await window.showTextDocument(doc)).document
	});

	context.subscriptions.push(transformCommand);
}

