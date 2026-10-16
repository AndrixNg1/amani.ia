import { chunkDocument } from './chunking';
import { ProcessingError } from './errors';

describe('chunkDocument', () => {
  const options = {
    chunkSize: 24,
    overlap: 4,
    maxParagraphCharacters: 24,
    maxChunks: 8,
  };
  it('produces stable indexes and checksums', () => {
    const source = '# Title\n\nOne two three four five six seven eight.';
    expect(chunkDocument(source, options)).toEqual(chunkDocument(source, options));
  });
  it('rejects unbounded chunk output', () => {
    expect(() => chunkDocument('a\n\nb\n\nc\n\nd', { ...options, maxChunks: 1 })).toThrow(
      ProcessingError,
    );
  });
});
