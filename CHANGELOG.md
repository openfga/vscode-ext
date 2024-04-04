# Changelog

## v0.2.21

### [0.2.21](https://github.com/openfga/vscode-ext/compare/v0.2.20...v0.2.21) (2024-04-04)

- feat: command to transform Modular Models to JSON
- fix: user & object formatter to allow '|' in ids

## v0.2.20

### [0.2.20](https://github.com/openfga/vscode-ext/compare/v0.2.19...v0.2.20) (2024-03-28)

- feat: initial beta support for [Modular Models](https://github.com/openfga/rfcs/blob/main/20231212-modular-models.md)

## v0.2.19

### [0.2.19](https://github.com/openfga/vscode-ext/compare/v0.2.18...v0.2.19) (2024-02-27)

- fix: user & object formatter to allow '/' in ids

## v0.2.18

### [0.2.18](https://github.com/openfga/vscode-ext/compare/v0.2.17...v0.2.18) (2024-02-09)

- feat: Validate `model_file` & import from external `tuple_file` fields

## v0.2.17

### [0.2.17](https://github.com/openfga/vscode-ext/compare/v0.2.16...v0.2.17) (2024-01-24)

- fix: `list` and `map` are now allowed as relation names

## v0.2.16

### [0.2.16](https://github.com/openfga/vscode-ext/compare/v0.2.15...v0.2.16) (2024-01-09)

- fix: "with" syntax not highlighting correctly
- fix: direct assignment not correctly highlighting when surrounded by brackets
- fix: Improper highlighting of comments at the end of a line

## v0.2.15

### [0.2.15](https://github.com/openfga/vscode-ext/compare/v0.2.14...v0.2.15) (2024-01-08)

- feat: warnings now issued for check objects that dont match declared tuples

## v0.2.14

### [0.2.14](https://github.com/openfga/vscode-ext/compare/v0.2.13...v0.2.14) (2024-01-05)

- feat: added validation for test tuples declared in the fga yaml
- feat: validation for check tests and list_objects fields
- feat: warnings now issued for check test and list_object user fields that dont match declared tuples

## v0.2.13

### [0.2.13](https://github.com/openfga/vscode-ext/compare/v0.2.12...v0.2.13) (2023-12-21)

- feat: validate tuples in the fga yaml document match the model
- fix: model validates in yaml when there are structural errors

## v0.2.12

### [0.2.12](https://github.com/openfga/vscode-ext/compare/v0.2.11...v0.2.12) (2023-12-13)

- fix: error when validating some valid models (error details: https://github.com/openfga/language/issues/120)

## v0.2.11

### [0.2.11](https://github.com/openfga/vscode-ext/compare/v0.2.10...v0.2.11) (2023-12-11)

- feat: Initial limited support for mixing operators

## v0.2.10

### [0.2.10](https://github.com/openfga/vscode-ext/compare/v0.2.9...v0.2.10) (2023-11-03)

- fix: syntax highlighting for conditions in yaml

## v0.2.9

### [0.2.9](https://github.com/openfga/vscode-ext/compare/v0.2.8...v0.2.9) (2023-11-03)

- feat: improved conditions support in the dsl
- fix: fix the store yaml schema causing improper validations

## v0.2.8

### [0.2.8](https://github.com/openfga/vscode-ext/compare/v0.2.7...v0.2.8) (2023-11-02)

- fix: addressed issues with enforced fields in yaml
- fix: disabled unimplemented completion

## v0.2.7

### [0.2.7](https://github.com/openfga/vscode-ext/compare/v0.2.6...v0.2.7) (2023-11-01)

- feat: validation for `.fga.yaml` files
- fix: Remove diagnostics when closing an associated file

## v0.2.6

### [0.2.6](https://github.com/openfga/vscode-ext/compare/v0.2.5...v0.2.6) (2023-10-23)

- feat: syntax highlighting for conditions

## v0.2.5

### [0.2.5](https://github.com/openfga/vscode-ext/compare/v0.2.4...v0.2.5) (2023-10-16)

- feat: syntax support for OpenFGA models embedded in YAML for testing
- feat: validation of OpenFGA models embedded in YAML for testing

## v0.2.4

### [0.2.4](https://github.com/openfga/vscode-ext/compare/v0.2.3...v0.2.4) (2023-10-10)

- feat: Hover descriptions for model keywords
- feat: Code actions for quickfixing some common errors

## v0.2.3

### [0.2.3](https://github.com/openfga/vscode-ext/compare/v0.2.2...v0.2.3) (2023-9-29)

- fix: correct document selector to enable language server for saved models on github.dev
- chore(docs): updated README and DEVELOPMENT documentation

## v0.2.2

### [0.2.2](https://github.com/openfga/vscode-ext/compare/v0.2.1...v0.2.2) (2023-9-28)

- chore: add setting to enable debug logs

## v0.2.1

### [0.2.1](https://github.com/openfga/vscode-ext/compare/v0.2.0...v0.2.1) (2023-9-27)

- feat: enable compatibility with [VS Code for Web](https://vscode.dev)

## v0.2.0

### [0.2.0](https://github.com/openfga/vscode-ext/compare/v0.1.0...v0.2.0) (2023-09-21)

- feat: Diagnostics for OpenFGA files

## v0.1.0

### [0.1.0](https://github.com/openfga/vscode-ext/releases/tag/v0.1.0) (2023-08-02)

Initial Release

- feat: Syntax highlighting for OpenFGA files
- feat: Custom OpenFGA dark theme
- feat: command to transform OpenFGA DSL to JSON
