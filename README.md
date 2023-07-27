# OpenFGA Extension for VS Code

VSCode extension that provides syntax highlighting for the [OpenFGA](https://openfga.dev/) DSL.

## Functionality

This Language Server currently is disabled. Tests have been preserved for usage once features are implemented. This includes an End-to-End test.

## Structure

```
.
├── client // Language Client
│   ├── src
│   │   ├── test // End to End tests for Language Client / Server
│   │   └── extension.ts // Language Client entry point
├── package.json // The extension manifest.
└── server // Language Server
    └── src
        └── server.ts // Language Server entry point
```

## Running the Client

- Run `npm install` in this folder. This installs all necessary npm modules.
- Open VS Code on this folder.
- Press Ctrl+Shift+B to start compiling the client and server in [watch mode](https://code.visualstudio.com/docs/editor/tasks#:~:text=The%20first%20entry%20executes,the%20HelloWorld.js%20file.).
- Switch to the Run and Debug View in the Sidebar (Ctrl+Shift+D).
- Select `Launch Client` from the drop down (if it is not already).
- Press ▷ to run the launch config (F5).

## Testing

- Run `npm install` in this folder. This installs all necessary npm modules.
- Run `npm run compile` to compile the code & client tests.
- Run `npm test` to execute the client test suite.

## TODOs

A rough [roadmap for development priorities.](https://github.com/orgs/openfga/projects/3)