
import {
	BrowserMessageReader,
	BrowserMessageWriter,
	createConnection,
} from 'vscode-languageserver/browser';

import { startServer } from './server.common';

const messageReader = new BrowserMessageReader(self);
const messageWriter = new BrowserMessageWriter(self);

const connection = createConnection(messageReader, messageWriter);

startServer(connection);