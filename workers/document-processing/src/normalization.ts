import { ProcessingError } from "./errors.js";

export const NORMALIZATION_VERSION = 1;

export function normalizeDocument(
  input: string,
  maxCharacters: number,
): string {
  const normalized = input
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) =>
      Array.from(line, (character) =>
        character.charCodeAt(0) < 0x20 && character !== "\t" ? "" : character,
      )
        .join("")
        .replace(/[\t ]+/g, " ")
        .trimEnd(),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!normalized || normalized.length > maxCharacters)
    throw new ProcessingError("NORMALIZATION_LIMIT_EXCEEDED");
  return normalized;
}
