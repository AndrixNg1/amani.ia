import type { KnowledgeRetrievalResultV1 } from '@amani/contracts';
import { buildEvidenceContext } from './evidence-context';

const result = (id: string, content: string): KnowledgeRetrievalResultV1 => ({
  chunkId: `00000000-0000-4000-8000-000000000${id}`,
  organizationId: '00000000-0000-4000-8000-000000000010',
  knowledgeBaseId: '00000000-0000-4000-8000-000000000011',
  sourceId: '00000000-0000-4000-8000-000000000012',
  documentId: '00000000-0000-4000-8000-000000000013',
  documentVersionId: '00000000-0000-4000-8000-000000000014',
  documentTitle: 'Handbook',
  chunkIndex: 0,
  content,
  contentChecksum: content,
  sectionReference: null,
  pageNumber: null,
  similarityScore: 0.9,
  citation: {
    knowledgeBaseId: '00000000-0000-4000-8000-000000000011',
    sourceId: '00000000-0000-4000-8000-000000000012',
    documentId: '00000000-0000-4000-8000-000000000013',
    documentVersionId: '00000000-0000-4000-8000-000000000014',
    chunkId: `00000000-0000-4000-8000-000000000${id}`,
  },
});

describe('buildEvidenceContext', () => {
  it('keeps ordered whole chunks and creates request-local IDs', () => {
    const context = buildEvidenceContext(
      [result('101', 'first'), result('102', 'second')],
      { maxChunks: 2, maxCharacters: 100 },
    );
    expect(context.evidence.map((item) => item.evidenceId)).toEqual(['E1', 'E2']);
  });

  it('does not split an oversized chunk or exceed the character budget', () => {
    const context = buildEvidenceContext(
      [result('101', 'too long'), result('102', 'safe')],
      { maxChunks: 2, maxCharacters: 5 },
    );
    expect(context.evidence.map((item) => item.result.content)).toEqual(['safe']);
    expect(context.characterCount).toBe(4);
  });

  it('deduplicates already authorized duplicate content without filtering access', () => {
    const context = buildEvidenceContext(
      [result('101', 'same'), result('102', 'same')],
      { maxChunks: 2, maxCharacters: 100 },
    );
    expect(context.evidence).toHaveLength(1);
  });
});
