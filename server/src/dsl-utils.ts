import { validator, errors } from "@openfga/syntax-transformer";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";

export function getDiagnosticsForDsl(dsl: string): Diagnostic[] {
  try {
    validator.validateDSL(dsl);
  } catch (err) {
    if (err instanceof errors.DSLSyntaxError || err instanceof errors.ModelValidationError) {
      return createDiagnostics(err);
    } else {
      console.error("Unhandled Exception: " + err);
    }
  }
  return [];
}

export const createDiagnostics = (err: errors.DSLSyntaxError | errors.ModelValidationError): Diagnostic[] => {
  return (
    err.errors.map((e: errors.DSLSyntaxSingleError | errors.ModelValidationSingleError) => {
      const linesStart = (e.line?.start || 1) - 1;
      const lineEnd = (e.line?.end || 1) - 1;
      const charactersStart = e.column?.start || 1;
      const charactersEnd = e.column?.end || 1;

      let source;
      let code = errors.ValidationError.InvalidSyntax;

      if (e instanceof errors.DSLSyntaxSingleError) {
        return {
          message: e.msg,
          severity: DiagnosticSeverity.Error,
          range: {
            start: { line: linesStart, character: charactersStart },
            end: { line: lineEnd, character: charactersEnd },
          },
          source: "SyntaxError",
          code,
          data: e.metadata,
        };
      } else if (e instanceof errors.ModelValidationSingleError) {
        if (e.metadata?.errorType) {
          code = e.metadata.errorType;
        }
        return {
          message: e.msg,
          severity: DiagnosticSeverity.Error,
          range: {
            start: { line: linesStart, character: charactersStart - 1 },
            end: { line: lineEnd, character: charactersEnd - 1 },
          },
          source: "ModelValidationError",
          code,
          data: e.metadata,
        };
      } else {
        throw new Error("Unhandled Exception: " + JSON.stringify(e, null, 4));
      }
    }) || []
  );
};
