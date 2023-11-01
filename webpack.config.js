//@ts-check
"use strict";

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

const path = require("path");
const webpack = require("webpack");

const webClientConfig = /** @type WebpackConfig */ {
  context: path.join(__dirname, "client"),

  mode: "none", // this leaves the source code as close as possible to the original (when packaging we set this to 'production')
  target: "webworker", // web extensions run in a webworker context
  entry: {
    "extension.browser": "./src/extension.browser.ts", // source of the web extension main file
    "test/index.browser": "./src/test/index.browser.ts", // source of the web extension test runner
  },
  output: {
    filename: "[name].js",
    path: path.join(__dirname, "client", "out"),
    libraryTarget: "commonjs",
  },
  resolve: {
    mainFields: ["browser", "module", "main"], // look for `browser` entry point in imported node modules
    extensions: [".ts", ".js"], // support ts-files and js-files
    alias: {
      // provides alternate implementation for node module and source files
    },
    fallback: {
      // Webpack 5 no longer polyfills Node.js core modules automatically.
      // see https://webpack.js.org/configuration/resolve/#resolvefallback
      // for the list of Node.js core module polyfills.
      //assert: require.resolve("assert"),
      path: require.resolve("path-browserify"),
      assert: require.resolve("assert-browserify"),
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
          },
        ],
      },
    ],
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: "process/browser", // provide a shim for the global `process` variable
    }),
  ],
  externals: {
    vscode: "commonjs vscode", // ignored because it doesn't exist
  },
  performance: {
    hints: false,
  },
  devtool: "nosources-source-map", // create a source map that points to the original source file
};

/** @type WebpackConfig */
const nodeClientConfig = {
  context: path.join(__dirname, "client"),

  target: "node", // vscode extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/

  entry: {
    "extension.node": "./src/extension.node.ts", // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
    "test/extension.test": "./src/test/extension.test.ts",
    "test/diagnostics.test": "./src/test/diagnostics.test.ts",
    "test/hover.test": "./src/test/hover.test.ts",
    "test/index.node": "./src/test/index.node.ts",
    "test/runTest": "./src/test/runTest.ts",
  },
  output: {
    // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
    path: path.resolve(__dirname, "client", "out"),
    filename: "[name].js",
    libraryTarget: "commonjs2",
    devtoolModuleFilenameTemplate: "../[resource-path]",
  },
  devtool: "source-map",
  externals: {
    vscode: "commonjs vscode", // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
    mocha: "commonjs mocha", // don't bundle
    "@vscode/test-electron": "commonjs @vscode/test-electron", // don't bundle
  },
  resolve: {
    // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
            options: {
              compilerOptions: {
                module: "es6", // override `tsconfig.json` so that TypeScript emits native JavaScript modules.
              },
            },
          },
        ],
      },
    ],
  },
};

/** @type WebpackConfig */
const nodeServerConfig = {
  context: path.join(__dirname, "server"),
  mode: "none",
  target: "node",
  entry: {
    "server.node": "./src/server.node.ts",
  },
  output: {
    filename: "[name].js",
    path: path.join(__dirname, "server", "out"),
    libraryTarget: "var",
    library: "serverExportVar",
  },
  resolve: {
    mainFields: ["module", "main"],
    extensions: [".ts", ".js"],
    alias: {},
    fallback: {},
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
          },
        ],
      },
    ],
  },
  externals: {
    vscode: "commonjs vscode",
  },
  performance: {
    hints: false,
  },
  devtool: "source-map",
};

/** @type WebpackConfig */
const browserServerConfig = {
  context: path.join(__dirname, "server"),
  mode: "none",
  target: "webworker", // web extensions run in a webworker context
  entry: {
    "server.browser": "./src/server.browser.ts",
  },
  output: {
    filename: "[name].js",
    path: path.join(__dirname, "server", "out"),
    libraryTarget: "var",
    library: "serverExportVar",
  },
  resolve: {
    mainFields: ["module", "main"],
    extensions: [".ts", ".js"],
    alias: {},
    fallback: {},
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
          },
        ],
      },
    ],
  },
  externals: {
    vscode: "commonjs vscode",
  },
  performance: {
    hints: false,
  },
  devtool: "source-map",
};

module.exports = [nodeClientConfig, webClientConfig, browserServerConfig, nodeServerConfig];
