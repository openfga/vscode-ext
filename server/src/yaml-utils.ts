import { Range, Position, Diagnostic, DiagnosticSeverity } from "vscode-languageserver";

import { Document, LineCounter, Node, Range as TokenRange, isMap, isPair, isScalar, isSeq } from "yaml";
import { LinePos } from "yaml/dist/errors";
import { BlockMap, SourceToken } from "yaml/dist/parse/cst";
import { getDiagnosticsForDsl } from "./dsl-utils";
import { ErrorObject, ValidateFunction } from "ajv";
import { transformer } from "@openfga/syntax-transformer";
import { YamlStoreValidator } from "./openfga-yaml-schema";
import { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";

export type YamlStoreValidateResults = {
  diagnostics: Diagnostic[];
  modelUri?: URI;
  modelDiagnostics?: Diagnostic[];
};

export type YamlFileFIeldContents = { contents: string; contentsUri: string; diagnostic?: Diagnostic };

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
  (yamlDoc.contents?.srcToken as BlockMap).items.forEach((i) => {
    if (i.key?.offset !== undefined && (i.key as SourceToken).source === field) {
      position = lineCounter.linePos(i.key?.offset);
    }
  });

  return position;
}

export function validateYamlStore(
  model: string,
  yamlDoc: Document,
  textDocument: TextDocument,
  map: YAMLSourceMap,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const schemaValidator: ValidateFunction = YamlStoreValidator();
  const jsonModel = transformer.transformDSLToJSONObject(model);
  let diagnosticRange;

  if (jsonModel && !schemaValidator.call({ jsonModel }, yamlDoc.toJSON())) {
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
      diagnostics.push({ message: message, range: diagnosticRange, severity, source: "OpenFGAYamlValidationError" });
    });
  }
  return diagnostics;
}

export function parseYamlModel(yamlDoc: Document, lineCounter: LineCounter): Diagnostic[] {
  const position = getFieldPosition(yamlDoc, lineCounter, "model");

  // Shift generated diagnostics by line of model, and indent of 2
  let dslDiagnostics = getDiagnosticsForDsl(yamlDoc.get("model") as string);
  dslDiagnostics = dslDiagnostics.map((d) => {
    const r = d.range;
    r.start.line += position.line;
    r.start.character += 2;
    r.end.line += position.line;
    r.end.character += 2;
    return d;
  });
  return dslDiagnostics;
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
export function getTooManyTuplesException(map: YAMLSourceMap, textDocument: TextDocument): Diagnostic {
  const range = map.nodes.get("tuples");
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
