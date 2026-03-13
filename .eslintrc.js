module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "prettier",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/recommended",
    "plugin:import/typescript",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  ignorePatterns: ["src/parser/grammar.ts"],
  rules: {
    "no-case-declarations": "off",
    "linebreak-style": ["error", "unix"],
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/no-explicit-any": "warn",
    quotes: ["error", "double"],
    semi: ["error", "always"],
    "max-len": [
      "warn",
      {
        code: 120,
      },
    ],
    "object-curly-spacing": ["error", "always"],
    "import/no-unresolved": [
      "error",
      {
        ignore: ["vscode"],
      },
    ],
  },
};
