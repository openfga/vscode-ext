import { errors } from "@openfga/syntax-transformer";

import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";

export const createDiagnostics = (
  err:
    | errors.DSLSyntaxError
    | errors.ModelValidationError
    | errors.ModuleTransformationError
    | errors.FGAModFileValidationError,
): Diagnostic[] => {
  return (
    err.errors.map(
      (
        e:
          | errors.DSLSyntaxSingleError
          | errors.ModelValidationSingleError
          | errors.ModuleTransformationSingleError
          | errors.FGAModFileValidationSingleError,
      ) => {
        const linesStart = e.line?.start === undefined ? 1 : e.line.start;
        const lineEnd = e.line?.end === undefined ? 1 : e.line.end;
        const charactersStart = e.column?.start === undefined ? 1 : e.column.start;
        const charactersEnd = e.column?.end === undefined ? 1 : e.column.end;

        let code = errors.ValidationError.InvalidSyntax;

        // Base line = 0, col = 0
        if (e instanceof errors.DSLSyntaxSingleError) {
          // Working, base line = 1, col = 0
          return {
            message: e.msg,
            severity: DiagnosticSeverity.Error,
            range: {
              start: { line: linesStart - 1, character: charactersStart },
              end: { line: lineEnd - 1, character: charactersEnd },
            },
            source: "SyntaxError",
            code,
            data: { ...e.metadata, file: e.file },
          };
        } else if (e instanceof errors.ModelValidationSingleError) {
          // Working, base line = 1, col = 1
          if (e.metadata?.errorType) {
            code = e.metadata.errorType;
          }
          return {
            message: e.msg,
            severity: DiagnosticSeverity.Error,
            range: {
              start: { line: linesStart - 1, character: charactersStart - 1 },
              end: { line: lineEnd - 1, character: charactersEnd - 1 },
            },
            source: "ModelValidationError",
            code,
            data: { ...e.metadata, file: e.file },
          };
        } else if (e instanceof errors.ModuleTransformationSingleError) {
          // Working on??
          return {
            message: e.msg,
            severity: DiagnosticSeverity.Error,
            range: {
              start: { line: linesStart - 1, character: charactersStart - 1 },
              end: { line: lineEnd - 1, character: charactersEnd - 1 },
            },
            source: "ModuleTransformationError",
            code,
            data: { ...e.metadata, file: e.file },
          };
        } else if (e instanceof errors.FGAModFileValidationSingleError) {
          // Working, base line = 1, col = 1
          const props = e.properties;
          return {
            message: props.msg,
            severity: DiagnosticSeverity.Error,
            range: {
              start: { line: linesStart - 1, character: charactersStart - 1 },
              end: { line: lineEnd - 1, character: charactersEnd - 1 },
            },
            source: "FGAModFileValidationError",
            code,
            metadata: { file: e.file },
          };
        } else {
          throw new Error("Unhandled Exception: " + JSON.stringify(e, null, 4));
        }
      },
    ) || []
  );
};
