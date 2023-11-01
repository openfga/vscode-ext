import { createConnection, ProposedFeatures } from "vscode-languageserver/node";

import { startServer } from "./server.common";

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
startServer(createConnection(ProposedFeatures.all));
