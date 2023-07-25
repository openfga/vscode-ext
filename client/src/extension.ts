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
		activeEditor.edit(editBuilder => {
			const range = new Range(0, 0, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
			editBuilder.replace(range, JSON.stringify(modelInApiFormat, null, "  "));
		});
	});

	context.subscriptions.push(transformCommand);
}

