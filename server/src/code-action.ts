import {
	CodeAction,
	CodeActionKind,
	Diagnostic,
	DocumentUri,
	OptionalVersionedTextDocumentIdentifier,
	TextDocumentEdit, 
	TextEdit
} from "vscode-languageserver";

interface CodeActionParams {
	docUri: DocumentUri,
	diagnostic: Diagnostic
}

export function getMissingDefinitionFix(params: CodeActionParams, indent: string, lineContent: string): CodeAction {

	const textDocEdit: TextDocumentEdit = {
		textDocument: OptionalVersionedTextDocumentIdentifier.create(params.docUri, null),
		edits: [
			TextEdit.replace({
				start: { line: params.diagnostic.range.start.line, character: 0 },
				end: { line: params.diagnostic.range.start.line, character: Number.MAX_VALUE } },
				`${lineContent}\n${indent}${indent}define ${params.diagnostic.data.symbol}: [typeName]`),
		]
	};

	return {
		title: `Fix: add definition for the \`${params.diagnostic.data.symbol}\`.`,
		kind: CodeActionKind.QuickFix,
		diagnostics: [params.diagnostic],
		edit: {
			documentChanges: [textDocEdit]
		},
	};
}

export function getDuplicationFix(params: CodeActionParams): CodeAction {

	const textDocEdit: TextDocumentEdit = {
		textDocument: OptionalVersionedTextDocumentIdentifier.create(params.docUri, null),
		edits: [
			TextEdit.del({ start: { line: params.diagnostic.range.start.line - 1, character: Number.MAX_VALUE },
				end: { line: params.diagnostic.range.start.line, character: Number.MAX_VALUE } }),
		]
	};

	return {
		title: `Fix: remove duplicate \`${params.diagnostic.data.symbol}\` relation definition.`,
		kind: CodeActionKind.QuickFix,
		edit: {
			documentChanges: [textDocEdit]
		},
	};
}

export function getReservedTypeNameFix(params: CodeActionParams): CodeAction {

	const textDocEdit: TextDocumentEdit = {
		textDocument: OptionalVersionedTextDocumentIdentifier.create(params.docUri, null),
		edits: [
			TextEdit.del({ start: { line: params.diagnostic.range.start.line - 1, character: Number.MAX_VALUE },
				end: { line: params.diagnostic.range.start.line, character: Number.MAX_VALUE } }),
		]
	};

	return {
		title: `Fix: remove duplicate \`${params.diagnostic.data.symbol}\` type.`,
		kind: CodeActionKind.QuickFix,
		edit: {
			documentChanges: [textDocEdit]
		},
	};
}
