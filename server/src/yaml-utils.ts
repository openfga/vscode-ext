import { Range, Position } from "vscode-languageserver";

import { Range as TokenRange, isMap, isPair, isScalar, isSeq } from "yaml";
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

export class YAMLSourceMap {
	public nodes;

	constructor() {
		this.nodes = new Map<string, TokenRange>();
	}

	public doMap(node: any | null, path: string[] = []) {

		const localPath = [...path];

		if (node === null) {
			return;
		}

		if (isMap(node)) {
			for (const n of node.items) {
				this.doMap(n, localPath);
			}
			return;
		}

		if (isPair(node) && isScalar(node.key) && node.key.source) {
			localPath.push(node.key.source);
			this.doMap(node.key, localPath);

			if (isSeq(node.value)) {
				for (const n in node.value.items) {
					localPath.push(n);
					this.doMap(node.value.items[n], localPath);
					localPath.pop();
				}
			} else if (isMap(node.value)) {
				for (const n of node.value.items) {
					this.doMap(n, localPath);
				}
			}
			return;
		}

		if (isScalar(node) && node.source && node.range) {
			this.nodes.set(localPath.join("."), node.range);
			return;
		}
	}
}
