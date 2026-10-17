/**
 * Public request to the stateless, documentary Knowledge RAG operation.
 * Identity and organization authority are established by the receiving service;
 * this shape is transport data, never an authorization grant.
 */
export interface KnowledgeRagRequestV1 {
  readonly organizationId: string;
  readonly question: string;
  readonly knowledgeBaseId?: string;
  readonly topK?: number;
  /** Cosine-similarity basis points forwarded as a bounded retrieval floor. */
  readonly minSimilarityBps?: number;
}

export type KnowledgeRagStatusV1 = 'answered' | 'insufficient_evidence';

/** Server-owned provenance selected from Knowledge retrieval evidence. */
export interface KnowledgeRagCitationV1 {
  readonly citationId: string;
  readonly evidenceId: string;
  readonly knowledgeBaseId: string;
  readonly sourceId: string;
  readonly documentId: string;
  readonly documentVersionId: string;
  readonly documentTitle: string;
  readonly chunkId: string;
  readonly chunkIndex: number;
  readonly pageNumber: number | null;
  readonly sectionReference: string | null;
}

/** Safe operational metadata. It deliberately excludes prompts and evidence text. */
export interface KnowledgeRagGenerationMetadataV1 {
  readonly provider: string;
  readonly model: string;
  readonly promptProfile: 'knowledge-rag-v1';
  readonly finishReason: string | null;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
}

export interface KnowledgeRagResponseV1 {
  readonly type: 'knowledge.rag.answer';
  readonly version: 1;
  readonly status: KnowledgeRagStatusV1;
  readonly answer: string;
  readonly citations: readonly KnowledgeRagCitationV1[];
  readonly retrieval: {
    readonly resultCount: number;
    readonly evidenceCount: number;
    readonly profile: {
      readonly provider: string;
      readonly model: string;
      readonly dimension: number;
      readonly configVersion: number;
      readonly metric: 'cosine';
    } | null;
  };
  readonly generation: KnowledgeRagGenerationMetadataV1 | null;
  readonly requestId: string;
  readonly correlationId: string;
}
