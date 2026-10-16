import { extractDocument } from "./extraction";
import { ProcessingError } from "./errors";

describe("extractDocument", () => {
  const limits = { maxExtractedCharacters: 1000, maxPages: 10 };
  it("accepts synthetic UTF-8 text and Markdown", async () => {
    await expect(
      extractDocument(
        new TextEncoder().encode("# Synthetic\n\nText"),
        "text/markdown",
        limits,
      ),
    ).resolves.toMatchObject({ text: "# Synthetic\n\nText" });
  });
  it("rejects unsupported MIME types", async () => {
    await expect(
      extractDocument(new Uint8Array([1]), "application/zip", limits),
    ).rejects.toMatchObject<Partial<ProcessingError>>({
      code: "UNSUPPORTED_DOCUMENT_TYPE",
    });
  });
});
