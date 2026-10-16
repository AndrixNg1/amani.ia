import { normalizeDocument } from './normalization';

describe('normalizeDocument', () => {
  it('is deterministic while preserving paragraph boundaries', () => {
    const source = 'Heading\r\n\r\nFirst\t paragraph\u0000\r\n\r\n\r\nSecond';
    expect(normalizeDocument(source, 1000)).toBe('Heading\n\nFirst paragraph\n\nSecond');
  });
});
