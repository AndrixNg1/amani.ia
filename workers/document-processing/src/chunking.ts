import { createHash } from "node:crypto";
import { ProcessingError } from "./errors.js";

export const CHUNKING_VERSION = 1;
export interface ChunkDraft {
  readonly chunkIndex: number;
  readonly content: string;
  readonly contentChecksum: string;
  readonly sectionReference?: string;
}

function pieces(value: string, maximum: number): readonly string[] {
  if (value.length <= maximum) return [value];
  const output: string[] = [];
  let remaining = value;
  while (remaining.length > maximum) {
    const boundary = remaining.lastIndexOf(" ", maximum);
    const end = boundary > Math.floor(maximum / 2) ? boundary : maximum;
    output.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trimStart();
  }
  if (remaining) output.push(remaining);
  return output;
}

export function chunkDocument(
  normalized: string,
  options: {
    readonly chunkSize: number;
    readonly overlap: number;
    readonly maxParagraphCharacters: number;
    readonly maxChunks: number;
  },
): readonly ChunkDraft[] {
  const paragraphs = normalized.split(/\n{2,}/).filter(Boolean);
  const output: ChunkDraft[] = [];
  let current = "";
  let section: string | undefined;
  const emit = () => {
    const content = current.trim();
    if (!content) return;
    output.push({
      chunkIndex: output.length,
      content,
      contentChecksum: createHash("sha256").update(content).digest("hex"),
      ...(section ? { sectionReference: section } : {}),
    });
    if (output.length > options.maxChunks)
      throw new ProcessingError("TOO_MANY_CHUNKS");
    current = options.overlap ? content.slice(-options.overlap) : "";
  };
  for (const paragraph of paragraphs) {
    if (/^#{1,6}\s+/.test(paragraph)) section = paragraph.replace(/^#+\s+/, "");
    for (const part of pieces(paragraph, options.maxParagraphCharacters)) {
      const candidate = current ? `${current}\n\n${part}` : part;
      if (candidate.length > options.chunkSize && current.trim()) emit();
      current = current ? `${current}\n\n${part}` : part;
      while (current.length > options.chunkSize) emit();
    }
  }
  emit();
  if (!output.length) throw new ProcessingError("NO_EXTRACTABLE_TEXT");
  return output;
}
