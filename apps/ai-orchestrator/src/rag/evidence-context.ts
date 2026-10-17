import type { KnowledgeRetrievalResultV1 } from '@amani/contracts';

export interface Evidence {
  readonly evidenceId: string;
  readonly result: KnowledgeRetrievalResultV1;
}

export interface EvidenceContext {
  readonly evidence: readonly Evidence[];
  readonly omittedCount: number;
  readonly characterCount: number;
}

/**
 * Uses whole, already-authorized chunks only. Deduplication cannot grant access;
 * it merely avoids repeating evidence supplied by Knowledge.
 */
export function buildEvidenceContext(
  results: readonly KnowledgeRetrievalResultV1[],
  limits: { readonly maxChunks: number; readonly maxCharacters: number },
): EvidenceContext {
  const evidence: Evidence[] = [];
  const seen = new Set<string>();
  let characters = 0;
  let omittedCount = 0;
  for (const result of results) {
    const duplicateKey = `${result.chunkId}:${result.contentChecksum}`;
    if (seen.has(duplicateKey)) {
      omittedCount += 1;
      continue;
    }
    seen.add(duplicateKey);
    if (
      evidence.length >= limits.maxChunks ||
      result.content.length > limits.maxCharacters - characters
    ) {
      omittedCount += 1;
      continue;
    }
    evidence.push({ evidenceId: `E${evidence.length + 1}`, result });
    characters += result.content.length;
  }
  return { evidence, omittedCount, characterCount: characters };
}
