# OpenFGA Extension for VS Code

VS Code extension that provides syntax highlighting for the [OpenFGA](https://openfga.dev/) [language for authorization models](https://openfga.dev/docs/configuration-language).

[![Release](https://img.shields.io/github/v/release/openfga/vscode-ext?sort=semver&color=green)](https://github.com/openfga/vscode-ext/releases)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://github.com/openfga/vscode-ext/blob/main/LICENSE)
[![Discord Server](https://img.shields.io/discord/759188666072825867?color=7289da&logo=discord "Discord Server")](https://discord.gg/8naAwJfWN6)
[![Twitter](https://img.shields.io/twitter/follow/openfga?color=%23179CF0&logo=twitter&style=flat-square "@openfga on Twitter")](https://twitter.com/openfga)

## About

[OpenFGA](https://openfga.dev) is an open source Fine-Grained Authorization solution inspired by [Google's Zanzibar paper](https://research.google/pubs/pub48190/). It was created by the FGA team at [Auth0](https://auth0.com) based on [Auth0 Fine-Grained Authorization (FGA)](https://fga.dev), available under [a permissive license (Apache-2)](https://github.com/openfga/rfcs/blob/main/LICENSE) and welcomes community contributions.

OpenFGA is designed to make it easy for application builders to model their permission layer, and to add and integrate fine-grained authorization into their applications. OpenFGA’s design is optimized for reliability and low latency at a high scale.

## Resources

- [OpenFGA Documentation](https://openfga.dev/docs)
- [OpenFGA API Documentation](https://openfga.dev/api/service)
- [Twitter](https://twitter.com/openfga)
- [OpenFGA Discord Community](https://discord.gg/8naAwJfWN6)
- [Zanzibar Academy](https://zanzibar.academy)
- [Google's Zanzibar Paper (2019)](https://research.google/pubs/pub48190/)

## Installation

- Download and install from [OpenFGA on the VS Code marketplace](https://marketplace.visualstudio.com/publishers/openfga)
- Alternatively, you can find [VSIX releases on GitHub](https://github.com/openfga/vscode-ext/releases) for manual installation

![Installing from VSIX file](resources/vsix-install.png)

## Usage

The extension currently offers 2 core features, with more to come.

- Syntax Highlighting for OpenFGA files
- A unique theme for OpenFGA for VS Code
	- Once installed, go to your extensions
	- Click on `OpenFGA` and click `Set Color Scheme`
	- Click on `OpenFGA Dark` in the prompt

![Prompt to set OpenFGA Dark color scheme](resources/set-color-scheme.png)


## Development

- Run `npm install` in the root directory. This installs all necessary npm modules.
- Run `npm run webpack` to bundle the code.
- Run `npm run compile && npm test` to execute the client test suite.

### Distribution (Optional)

To generate an installable build of this extension, you can do the following:

- Run `npm install --global @vscode/vsce` to get the latest version of `vsce` for packaging 
- Run `vsce package` to generate an installable `VISX` artifact for testing or distribution

### Structure

```
.
├── package.json // The extension manifest
├── client // Language client
│   ├── src
│   │   ├── test // End to end tests for language client / server
│   │   └── extension.ts // Language client entry point
```

### Running the Client

- Run `npm install` in the root directory. This installs all necessary npm modules.
- Open the root directory in VS Code.
- Press Ctrl+Shift+B (Windows) or Command+Shift+B (OSX) to start compiling the client and server in [watch mode](https://code.visualstudio.com/docs/editor/tasks#:~:text=The%20first%20entry%20executes,the%20HelloWorld.js%20file.).
- Switch to the Run and Debug View in the Sidebar (Ctrl+Shift+D on Windows, Command+Shift+D on OSX).
- Select `Launch Client` from the drop down (if it is not already).
- Press ▷ to run the launch config (F5).

### Testing

- Run `npm install` in the root directory. This installs all necessary npm modules.
- Run `npm run compile` to compile the code & client for testing.
- Run `npm test` to execute the client test suite.

## Roadmap

A rough [roadmap](https://github.com/orgs/openfga/projects/3) for development priorities.

## Contributing

See [CONTRIBUTING](https://github.com/openfga/.github/blob/main/CONTRIBUTING.md).

## Author

[OpenFGA](https://github.com/openfga)

## License

This project is licensed under the Apache-2.0 license. See the [LICENSE](https://github.com/openfga/vscode-ext/blob/main/LICENSE) file for more info.
