import js from "@eslint/js";
import tseslint from "typescript-eslint";
import importX from "eslint-plugin-import-x";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      "client/node_modules/**",
      "client/out/**",
      "server/node_modules/**",
      "server/out/**",
      "src/parser/grammar.ts",
    ],
  },
  {
    files: ["client/src/**/*.{ts,tsx}", "server/src/**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      importX.flatConfigs.recommended,
      prettier,
    ],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: "module",
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
        ...globals.node,
      },
    },
    rules: {
      // TypeScript handles module resolution; the rules below require a
      // TypeScript-aware resolver to work correctly with ambient VSCode
      // modules and declaration files. tsc catches these errors instead.
      "import-x/no-unresolved": "off",
      "import-x/namespace": "off",
      "import-x/named": "off",
      "no-case-declarations": "off",
      "linebreak-style": ["error", "unix"],
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      quotes: ["error", "double"],
      semi: ["error", "always"],
      "max-len": ["warn", { code: 120 }],
      "object-curly-spacing": ["error", "always"],
    },
  },
);
