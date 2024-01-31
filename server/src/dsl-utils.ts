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
      const lines = e.getLine(-1);
      let characters;
      let source;

      let code = errors.ValidationError.InvalidSyntax;

      if (e instanceof errors.DSLSyntaxSingleError) {
        characters = e.getColumn();
        source = "SyntaxError";
      } else if (e instanceof errors.ModelValidationSingleError) {
        characters = e.getColumn(-1);
        source = "ModelValidationError";
        if (e.metadata?.errorType) {
          code = e.metadata.errorType;
        }
      } else {
        throw new Error("Unhandled Exception: " + JSON.stringify(e, null, 4));
      }

      return {
        message: e.msg,
        severity: DiagnosticSeverity.Error,
        range: {
          start: { line: lines.start, character: characters.start },
          end: { line: lines.end, character: characters.end },
        },
        source,
        code,
        data: e.metadata,
      };
    }) || []
  );
};
