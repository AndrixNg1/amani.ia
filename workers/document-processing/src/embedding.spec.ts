import { DeterministicTestEmbeddingProvider } from './embedding';

describe('DeterministicTestEmbeddingProvider', () => {
  it('returns repeatable vectors with the configured dimension', async () => {
    const provider = new DeterministicTestEmbeddingProvider('test', 8, 1);
    await expect(provider.embed(['synthetic text'])).resolves.toEqual(
      await provider.embed(['synthetic text']),
    );
  });
});
