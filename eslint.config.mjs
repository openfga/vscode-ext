import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import importX from "eslint-plugin-import-x";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["client/out/", "server/out/"]),
  {
    files: ["client/src/**/*.{ts,tsx}", "server/src/**/*.{ts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.recommended, importX.flatConfigs.recommended],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // The preset defers this to tsc, which only reports it with allowUnreachableCode: false (unset here).
      "no-unreachable": "error",
      // Without a TypeScript-aware resolver these fail on ambient VSCode modules and declaration files, and import-x's
      // `typescript` preset needs eslint-import-resolver-typescript (not installed). tsc catches these errors instead.
      "import-x/no-unresolved": "off",
      "import-x/namespace": "off",
      "import-x/named": "off",
      // Existing `any` usages are tolerated but surfaced as warnings.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  // Must stay last apart from the override below: turns off any rule that conflicts with Prettier.
  eslintConfigPrettier,
  // Keeps the ASI guard that eslint-config-prettier disables.
  { rules: { "no-unexpected-multiline": "error" } },
]);
