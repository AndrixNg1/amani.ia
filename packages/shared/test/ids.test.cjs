const { describe, test, expect } = require('@jest/globals');
const {
  MAX_TRACE_ID_LENGTH,
  isRequestId,
  isCorrelationId,
  createRequestId,
  createCorrelationId,
  resolveCorrelationId,
} = require('../dist/index.js');

describe('request and correlation identifiers', () => {
  test.each(['synthetic-123', 'a_B.42', 'a'.repeat(128)])('accepts bounded safe tracing ID %s', (id) => {
    expect(isRequestId(id)).toBe(true);
    expect(isCorrelationId(id)).toBe(true);
    expect(resolveCorrelationId(id)).toBe(id);
  });

  test.each([undefined, null, 42, {}, ['first', 'second'], '', ' ', ' leading', 'trailing ', '\r\nX-User-Id:admin', 'a\nb', 'id/other', 'id,other', 'é', 'a'.repeat(129)])(
    'rejects untrusted header %p', (value) => {
      expect(isRequestId(value)).toBe(false);
      expect(isCorrelationId(value)).toBe(false);
      const replacement = resolveCorrelationId(value);
      expect(isCorrelationId(replacement)).toBe(true);
      expect(replacement).not.toBe(value);
    });

  test('generates independent cryptographic UUID v4 identifiers', () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    const request = createRequestId();
    const correlation = createCorrelationId();
    expect(request).toMatch(uuid);
    expect(correlation).toMatch(uuid);
    expect(request).not.toBe(correlation);
    expect(createRequestId()).not.toBe(request);
    expect(MAX_TRACE_ID_LENGTH).toBe(128);
  });
});
