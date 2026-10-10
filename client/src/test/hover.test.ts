import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate } from "./helper";

// The hover handler (server/src/server.common.ts) renders
//   **<symbol>**  \n<summary>  \n[Link to documentation](<link>)
// for any keyword in the documentation map, and returns nothing for a word
// that is not a keyword.
//
// Assertions on summary and link use substrings rather than the exact rendered
// string: the prose in server/src/documentation.ts is expected to be edited,
// and pinning it word-for-word would fail on a docs tweak with nothing broken.

suite("Should show hover", () => {
  const docUri = getDocUri("test.fga");
  const hoverDocUri = getDocUri("hover.fga");

  test("Displays hover text", async () => {
    const hovers = await getHovers(docUri, new vscode.Position(1, 6));

    assert.strictEqual(hovers.length, 1);
    assert.deepStrictEqual(hovers[0].range, toRange(1, 2, 1, 8));
    assertHoverContains(hovers[0], "**schema**");
    assertHoverContains(hovers[0], "Defines the schema version to be used");
    assertHoverContains(hovers[0], "https://openfga.dev/docs/modeling/migrating/migrating-schema-1-1");
  });

  test("Displays hover text for the type keyword", async () => {
    const hovers = await getHovers(docUri, new vscode.Position(2, 1));

    assert.strictEqual(hovers.length, 1);
    assert.deepStrictEqual(hovers[0].range, toRange(2, 0, 2, 4));
    assertHoverContains(hovers[0], "**type**");
    assertHoverContains(hovers[0], "https://openfga.dev/docs/concepts#what-is-a-type");
  });

  test("Displays hover text for the relations keyword", async () => {
    const hovers = await getHovers(docUri, new vscode.Position(4, 4));

    assert.strictEqual(hovers.length, 1);
    assert.deepStrictEqual(hovers[0].range, toRange(4, 2, 4, 11));
    assertHoverContains(hovers[0], "**relations**");
    assertHoverContains(hovers[0], "https://openfga.dev/docs/concepts#what-is-a-relation");
  });

  test("Displays hover text for the define keyword", async () => {
    const hovers = await getHovers(docUri, new vscode.Position(5, 6));

    assert.strictEqual(hovers.length, 1);
    assert.deepStrictEqual(hovers[0].range, toRange(5, 4, 5, 10));
    assertHoverContains(hovers[0], "**define**");
  });

  test("Displays hover text for the and operator", async () => {
    const hovers = await getHovers(hoverDocUri, new vscode.Position(7, 27));

    assert.strictEqual(hovers.length, 1);
    assert.deepStrictEqual(hovers[0].range, toRange(7, 26, 7, 29));
    assertHoverContains(hovers[0], "**and**");
    assertHoverContains(hovers[0], "https://openfga.dev/docs/configuration-language#the-intersection-operator");
  });

  test("Displays hover text for the or operator", async () => {
    const hovers = await getHovers(hoverDocUri, new vscode.Position(8, 30));

    assert.strictEqual(hovers.length, 1);
    assert.deepStrictEqual(hovers[0].range, toRange(8, 29, 8, 31));
    assertHoverContains(hovers[0], "**or**");
    assertHoverContains(hovers[0], "https://openfga.dev/docs/configuration-language#the-union-operator");
  });

  test("Displays hover text for the from keyword", async () => {
    const hovers = await getHovers(hoverDocUri, new vscode.Position(14, 28));

    assert.strictEqual(hovers.length, 1);
    assert.deepStrictEqual(hovers[0].range, toRange(14, 27, 14, 31));
    assertHoverContains(hovers[0], "**from**");
    assertHoverContains(
      hovers[0],
      "https://openfga.dev/docs/configuration-language#referencing-relations-on-related-objects",
    );
  });

  // `but not` is the only two-word keyword. getRangeOfWord (server/src/helpers.ts)
  // widens the range in both directions, so hovering either half must report the
  // whole operator rather than the single word under the cursor.
  test("Displays hover text for but not when hovering but", async () => {
    const hovers = await getHovers(hoverDocUri, new vscode.Position(9, 34));

    assert.strictEqual(hovers.length, 1);
    assert.deepStrictEqual(hovers[0].range, toRange(9, 33, 9, 40));
    assertHoverContains(hovers[0], "**but not**");
    assertHoverContains(hovers[0], "https://openfga.dev/docs/configuration-language#the-exclusion-operator");
  });

  test("Displays hover text for but not when hovering not", async () => {
    const hovers = await getHovers(hoverDocUri, new vscode.Position(9, 38));

    assert.strictEqual(hovers.length, 1);
    assert.deepStrictEqual(hovers[0].range, toRange(9, 33, 9, 40));
    assertHoverContains(hovers[0], "**but not**");
  });

  test("Displays no hover for a word that is not a keyword", async () => {
    const hovers = await getHovers(hoverDocUri, new vscode.Position(3, 7));

    assert.strictEqual(hovers.length, 0);
  });
});

function toRange(sLine: number, sChar: number, eLine: number, eChar: number) {
  const start = new vscode.Position(sLine, sChar);
  const end = new vscode.Position(eLine, eChar);
  return new vscode.Range(start, end);
}

async function getHovers(docUri: vscode.Uri, position: vscode.Position): Promise<vscode.Hover[]> {
  await activate(docUri);

  return await vscode.commands.executeCommand<vscode.Hover[]>("vscode.executeHoverProvider", docUri, position);
}

// A hover's contents are MarkdownString | MarkedString entries; flatten them to
// plain text so a test can assert on what the user actually reads.
function hoverText(hover: vscode.Hover): string {
  return hover.contents.map((content) => (typeof content === "string" ? content : content.value)).join("\n");
}

function assertHoverContains(hover: vscode.Hover, expected: string) {
  const actual = hoverText(hover);
  assert.ok(
    actual.includes(expected),
    `expected hover to contain ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}
