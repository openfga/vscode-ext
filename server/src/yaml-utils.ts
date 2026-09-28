import { Range, Position, Diagnostic, DiagnosticSeverity } from "vscode-languageserver";

import { Document, LineCounter, Node, Range as TokenRange, isMap, isPair, isScalar, isSeq, parse } from "yaml";
import type { CST } from "yaml";
import { ErrorObject, ValidateFunction } from "ajv";
import { transformer, validator } from "@openfga/syntax-transformer";
import { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";

export type YamlStoreValidateResults = {
  diagnostics: Diagnostic[];
  modelUri?: URI;
  modelDiagnostics?: Diagnostic[];
};

export type YamlFileFIeldContents = { contents: string; contentsUri: string; diagnostic?: Diagnostic };

type LinePos = ReturnType<LineCounter["linePos"]>;

export function isStringValue(str: unknown) {
  return typeof str == "string" || str instanceof String;
}

export function rangeFromLinePos(linePos: [LinePos] | [LinePos, LinePos] | undefined): Range {
  if (linePos === undefined) {
    return { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
  }
  // TokenRange and linePos are both 1-based
  const start: Position = { line: linePos[0].line - 1, character: linePos[0].col - 1 };
  const end: Position = linePos.length == 2 ? { line: linePos[1].line - 1, character: linePos[1].col - 1 } : start;
  return { start, end };
}

// Only gets the line of 1st depth. This should be deprecated and replaced.
export function getFieldPosition(
  yamlDoc: Document,
  lineCounter: LineCounter,
  field: string,
): { line: number; col: number } {
  let position: { line: number; col: number } = { line: 0, col: 0 };

  // Get the model token and find its position
  (yamlDoc.contents?.srcToken as CST.BlockMap).items.forEach((i) => {
    if (i.key?.offset !== undefined && (i.key as CST.SourceToken).source === field) {
      position = lineCounter.linePos(i.key?.offset);
    }
  });

  return position;
}

// Formats a `tuple_file` may be written in, mirroring the CLI's own reader
// (openfga/cli, internal/tuplefile). `.csv` is deliberately absent: parsing it
// faithfully means reproducing the CLI's header ordering, optional columns and
// condition-context rules, and a subtly wrong version would report tuples as
// malformed that the CLI accepts. A `.csv` tuple_file is still checked for
// existence, as before; its tuples are simply not merged yet.
const PARSEABLE_TUPLE_FILE_EXTENSIONS = [".yaml", ".yml", ".json", ".jsonl"];

export function isParseableTupleFile(fileName: string): boolean {
  return PARSEABLE_TUPLE_FILE_EXTENSIONS.some((ext) => fileName.toLowerCase().endsWith(ext));
}

// Parses the contents of a `tuple_file` into the tuple list the store schema
// expects. Throws when the contents are not a list of tuples, so the caller can
// report the failure against the `tuple_file` entry rather than silently
// validating an incomplete tuple set.
export function parseTupleFileContents(fileName: string, contents: string): unknown[] {
  let parsed: unknown;

  if (fileName.toLowerCase().endsWith(".jsonl")) {
    parsed = contents
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line));
  } else {
    // YAML is a superset of JSON, so one parser covers .yaml, .yml and .json.
    parsed = parse(contents);
  }

  if (parsed === null || parsed === undefined) {
    return [];
  }

  if (!Array.isArray(parsed)) {
    throw new Error("expected a list of tuples");
  }

  return parsed;
}

// A tuple that came from a `tuple_file` has no node in the open document, so a
// diagnostic about it has no range of its own and would land at line 1. This
// maps the validator's instance path back to the `tuple_file` entry that
// supplied the tuple, giving the diagnostic somewhere real to point and a file
// to name.
export type ExternalTupleSource = { range: TokenRange | undefined; file: string };
export type ExternalTupleResolver = (instancePath: string) => ExternalTupleSource | undefined;

// One resolved `tuple_file` entry: where it was written, and what it held.
export type ResolvedTupleFile = ExternalTupleSource & { tuples: unknown[] };

// Every `tuple_file` in a store document: at most one at store level, and at
// most one per test, keyed by the test's index.
export type ExternalTuples = { store?: ResolvedTupleFile; tests: Map<number, ResolvedTupleFile> };

/* eslint-disable  @typescript-eslint/no-explicit-any */
// Produces the store object to validate, with file-sourced tuples merged in,
// and a resolver that maps a validator instance path back to the file a tuple
// came from.
//
// File tuples are APPENDED to the inline ones rather than prepended. The
// existing diagnostics look inline tuples up by index (`tuples.3`) against a
// source map built from this document, so prepending would shift every inline
// tuple's index and send correct diagnostics to the wrong line. Appending
// leaves inline indices untouched, and makes "index >= inline count" the test
// for whether a tuple came from a file. Tuple order carries no meaning here —
// a store's tuples are a set.
export function mergeExternalTuples(
  storeJson: any,
  external: ExternalTuples,
): { storeJson: any; resolveExternalTuple: ExternalTupleResolver } {
  const merged = storeJson && typeof storeJson === "object" ? { ...storeJson } : storeJson;
  const storeInlineCount = Array.isArray(merged?.tuples) ? merged.tuples.length : 0;
  const testInlineCounts = new Map<number, number>();

  if (merged && typeof merged === "object") {
    if (external.store) {
      merged.tuples = [...(Array.isArray(merged.tuples) ? merged.tuples : []), ...external.store.tuples];
    }

    if (external.tests.size && Array.isArray(merged.tests)) {
      merged.tests = merged.tests.map((test: any, index: number) => {
        const resolved = external.tests.get(index);
        const inline = Array.isArray(test?.tuples) ? test.tuples : [];
        testInlineCounts.set(index, inline.length);
        if (!resolved || !test || typeof test !== "object") {
          return test;
        }
        return { ...test, tuples: [...inline, ...resolved.tuples] };
      });
    }
  }

  const resolveExternalTuple: ExternalTupleResolver = (instancePath) => {
    const testMatch = instancePath.match(/^\/tests\/(\d+)\/tuples\/(\d+)/);
    if (testMatch) {
      const testIndex = Number(testMatch[1]);
      const resolved = external.tests.get(testIndex);
      if (resolved && Number(testMatch[2]) >= (testInlineCounts.get(testIndex) ?? 0)) {
        return { range: resolved.range, file: resolved.file };
      }
      return undefined;
    }

    const storeMatch = instancePath.match(/^\/tuples\/(\d+)/);
    if (storeMatch && external.store && Number(storeMatch[1]) >= storeInlineCount) {
      return { range: external.store.range, file: external.store.file };
    }

    return undefined;
  };

  return { storeJson: merged, resolveExternalTuple };
}
/* eslint-enable  @typescript-eslint/no-explicit-any */

export function validateYamlStore(
  model: string,
  yamlDoc: Document,
  textDocument: TextDocument,
  map: YAMLSourceMap,
  storeJson?: unknown,
  resolveExternalTuple?: ExternalTupleResolver,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const schemaValidator: ValidateFunction = validator.YamlStoreValidator();
  const jsonModel = transformer.transformDSLToJSONObject(model);
  let diagnosticRange;

  // `storeJson` is the document's own JSON with any `tuple_file` contents
  // merged in. Callers that resolve no external files pass nothing and get the
  // previous behaviour.
  const storeToValidate = storeJson ?? yamlDoc.toJSON();

  if (jsonModel && !schemaValidator.call({ jsonModel }, storeToValidate)) {
    schemaValidator.errors?.forEach((e: ErrorObject) => {
      let message;
      let severity: DiagnosticSeverity = DiagnosticSeverity.Error;

      if (e.keyword === "valid_store_warning") {
        severity = DiagnosticSeverity.Warning;
        const key = e.instancePath.substring(1).replace(/\//g, ".");
        diagnosticRange = getRangeFromToken(map.nodes.get(key), textDocument);
        message = "warning: " + e.message;
      } else if (e.keyword === "additionalProperties") {
        // If we've got invalid keys, mark them
        let key = e.params["additionalProperty"];
        if (e.instancePath) {
          const path = e.instancePath.substring(1).replace(/\//g, ".");
          key = path.concat(".", key);
        }
        diagnosticRange = getRangeFromToken(map.nodes.get(key), textDocument);
        message = key + " is not a recognized key.";
      } else if (e.keyword === "required" || e.keyword === "valid_tuple") {
        const key = e.instancePath.substring(1).split("/");

        let range;

        if (map.nodes.get(key.join("."))) {
          // If in map, use that range
          range = map.nodes.get(key.join("."));
        } else if (yamlDoc.getIn(key)) {
          // If found in the yaml doc
          range = (yamlDoc.getIn(key) as Node).range;
        } else {
          // If out of options, use parent
          range = map.nodes.get(key.slice(0, -1).join("."));
        }

        diagnosticRange = getRangeFromToken(range, textDocument);
        message = key.join(".") + " " + e.message;
      } else if (e.keyword === "type") {
        const key = e.instancePath.substring(1).split("/");
        diagnosticRange = getRangeFromToken(map.nodes.get(key.join(".")), textDocument);
        message = key.join(".") + " " + e.message;
      } else {
        // All other schema errors
        const key = e.instancePath.substring(1).replace(/\//g, ".");
        diagnosticRange = getRangeFromToken(map.nodes.get(key), textDocument);
        message = key + " " + e.message;
      }
      // A file-sourced tuple has no node of its own in this document. Point at
      // the `tuple_file` entry that supplied it and name the file, so the
      // diagnostic is clickable and says where to go and fix it.
      const external = resolveExternalTuple?.(e.instancePath);
      if (external) {
        diagnosticRange = getRangeFromToken(external.range, textDocument);
        message = message + " (from " + external.file + ")";
      }

      diagnostics.push({ message: message, range: diagnosticRange, severity, source: "OpenFGAYamlValidationError" });
    });
  }
  return diagnostics;
}

export class YAMLSourceMap {
  public nodes;

  constructor() {
    this.nodes = new Map<string, TokenRange>();
  }

  /* eslint-disable  @typescript-eslint/no-explicit-any */
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

// Exception for too many tuples, notifying validation is disabled
export function getTooManyTuplesException(range: TokenRange, textDocument: TextDocument): Diagnostic {
  return {
    message: "Tuple limit of 1,000 has been reached. Validation is disabled.",
    severity: DiagnosticSeverity.Warning,
    range: getRangeFromToken(range, textDocument),
  };
}

export function getRangeFromToken(range: TokenRange | undefined | null, textDocument: TextDocument): Range {
  let start = { line: 0, character: 0 };
  let end = { line: 0, character: 0 };
  if (range) {
    start = textDocument.positionAt(range?.[0]);
    end = textDocument.positionAt(range?.[1]);
  }
  return { start, end };
}
