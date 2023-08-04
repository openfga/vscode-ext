import * as path from 'path';
import { window, workspace, ExtensionContext, commands, Range } from 'vscode';
import { friendlySyntaxToApiSyntax } from '@openfga/syntax-transformer';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {

	const module = path.join(__dirname, '..', '..', 'server', 'out', 'server.js');
	const debugOptions = { execArgv: ['--nolazy', '--inspect=6012'] };
	const serverOptions: ServerOptions = {
		run: { module, transport: TransportKind.ipc },
		debug: { module, transport: TransportKind.ipc, options: debugOptions}
	};

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ scheme: 'file', language: 'openfga' }],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'openfgaLanguageServer',
		'OpenFGA Language Server',
		serverOptions,
		clientOptions
	);

	// Start the client. This will also launch the server
	client.start();

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

		return (await window.showTextDocument(doc)).document;
	});

	context.subscriptions.push(transformCommand);
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}