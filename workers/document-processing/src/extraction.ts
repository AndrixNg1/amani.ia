import mammoth from "mammoth";
import pdf from "pdf-parse";
import { ProcessingError } from "./errors.js";

export interface ExtractedDocument {
  readonly text: string;
  readonly pageCount?: number;
}

function utf8(bytes: Uint8Array): string {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (text.includes("\u0000")) throw new ProcessingError("EXTRACTION_FAILED");
    return text;
  } catch (error) {
    if (error instanceof ProcessingError) throw error;
    throw new ProcessingError("EXTRACTION_FAILED");
  }
}

export async function extractDocument(
  bytes: Uint8Array,
  mimeType: string,
  limits: {
    readonly maxExtractedCharacters: number;
    readonly maxPages: number;
  },
): Promise<ExtractedDocument> {
  let extracted: ExtractedDocument;
  try {
    switch (mimeType) {
      case "text/plain":
      case "text/markdown":
        extracted = { text: utf8(bytes) };
        break;
      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
        const result = await mammoth.extractRawText({
          buffer: Buffer.from(bytes),
        });
        extracted = { text: result.value };
        break;
      }
      case "application/pdf": {
        const result = await pdf(Buffer.from(bytes));
        if (result.numpages > limits.maxPages)
          throw new ProcessingError("FILE_TOO_LARGE");
        extracted = { text: result.text, pageCount: result.numpages };
        break;
      }
      default:
        throw new ProcessingError("UNSUPPORTED_DOCUMENT_TYPE");
    }
  } catch (error) {
    if (error instanceof ProcessingError) throw error;
    throw new ProcessingError("EXTRACTION_FAILED");
  }
  if (!extracted.text.trim()) throw new ProcessingError("NO_EXTRACTABLE_TEXT");
  if (extracted.text.length > limits.maxExtractedCharacters)
    throw new ProcessingError("NORMALIZATION_LIMIT_EXCEEDED");
  return extracted;
}
