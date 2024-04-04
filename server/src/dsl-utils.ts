import { errors } from "@openfga/syntax-transformer";

import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";

export const createDiagnostics = (err: errors.BaseMultiError<errors.BaseError>): Diagnostic[] => {
  return (
    err.errors.map((e: errors.BaseError) => {
      const linesStart = e.line?.start === undefined ? 0 : e.line.start;
      const lineEnd = e.line?.end === undefined ? 0 : e.line.end;
      const charactersStart = e.column?.start === undefined ? 0 : e.column.start;
      const charactersEnd = e.column?.end === undefined ? 0 : e.column.end;

      const diagnostic = {
        message: e.msg,
        severity: DiagnosticSeverity.Error,
        range: {
          start: { line: linesStart, character: charactersStart },
          end: { line: lineEnd, character: charactersEnd },
        },
        source: "SyntaxError",
        code: errors.ValidationError.InvalidSyntax,
        data: {},
      };

      if (e instanceof errors.DSLSyntaxSingleError) {
        diagnostic.data = { ...e.metadata, file: e.file };
      } else if (e instanceof errors.ModelValidationSingleError) {
        if (e.metadata?.errorType) {
          diagnostic.code = e.metadata.errorType;
        }
        diagnostic.source = "ModelValidationError";
        diagnostic.data = { ...e.metadata, file: e.file };
      } else if (e instanceof errors.ModuleTransformationSingleError) {
        diagnostic.source = "ModuleTransformationError";
        diagnostic.data = { ...e.metadata, file: e.file };
      } else if (e instanceof errors.FGAModFileValidationSingleError) {
        diagnostic.source = "FGAModFileValidationError";
        diagnostic.data = { file: e.file };
      } else {
        throw new Error("Unhandled Exception: " + JSON.stringify(e, null, 4));
      }

      return diagnostic;
    }) || []
  );
};
