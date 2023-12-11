import { Position, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

export function getRangeOfWord(document: TextDocument, position: Position): Range {
  const text = document.getText();

  let pointerStart = document.offsetAt(position);
  let pointerEnd = document.offsetAt(position);

  while (text.charAt(pointerStart).match(/\w/)) {
    pointerStart--;
  }

  while (text.charAt(pointerEnd).match(/\w/)) {
    pointerEnd++;
  }

  let start = document.positionAt(pointerStart + 1);
  let end = document.positionAt(pointerEnd);

  if (
    document.getText({ start, end }) === "but" &&
    // If we've hovered "but", track forward and check if there is a matching "not"
    document.getText({ start, end: document.positionAt(pointerEnd + 4) }) === "but not"
  ) {
    end = document.positionAt(pointerEnd + 4);
  } else if (
    document.getText({ start, end }) === "not" &&
    // If we've hovered "not", track backward and check if there is a matching "but"
    document.getText({ start: document.positionAt(pointerStart - 3), end }) === "but not"
  ) {
    start = document.positionAt(pointerStart - 3);
  }

  return { start, end };
}
