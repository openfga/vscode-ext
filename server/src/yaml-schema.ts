import { Range, Position } from "vscode-languageserver";
import { LinePos } from "yaml/dist/errors";

export function rangeFromLinePos(linePos: [LinePos] | [LinePos, LinePos] | undefined): Range {
	if (linePos === undefined) {
		return { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
	}
	// TokenRange and linePos are both 1-based
	const start: Position = { line: linePos[0].line - 1, character: linePos[0].col - 1 };
	const end: Position = linePos.length == 2 ? { line: linePos[1].line - 1, character: linePos[1].col - 1 } : start;
	return { start, end };
}