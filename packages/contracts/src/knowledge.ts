import type { SourceFamily, SourceKind } from '@amani/types';
import type { CoreAuthorizationDecision, JobMetadata } from './index';

/** Opaque provenance. No source URL, credential or shared persistence entity. */
export interface SourceReference {
  readonly sourceFamily: SourceFamily;
  readonly sourceKind: SourceKind;
  readonly provider?: string;
  readonly externalReference?: string;
}
export interface KnowledgeAuthorizationRequest {
  readonly organizationId: string;
  readonly permission: 'knowledge.documents.read' | 'plugins.use' | 'plugins.manage';
  /** Only a plugins.manage caller may resolve a grant recipient. */
  readonly subjectMembershipId?: string;
}
export interface KnowledgeAuthorizationResponse {
  readonly decision: CoreAuthorizationDecision;
  readonly membershipId: string;
  readonly subjectMembershipId?: string;
}
/** Versioned durable intent; the queue transport is deliberately not part of it. */
export interface KnowledgeDocumentIngestionRequestedV1 {
  readonly type: 'knowledge.document.ingestion.requested';
  readonly version: 1;
  readonly job: JobMetadata;
  readonly organizationId: string;
  readonly knowledgeBaseId: string;
  readonly sourceId: string;
  readonly documentId: string;
  readonly documentVersionId: string;
  readonly source: SourceReference;
  readonly storage: {
    readonly bucket: string;
    readonly key: string;
    /** Immutable S3 object version, never latest/head. */
    readonly versionId: string;
  };
  readonly mimeType: string;
  readonly size: number;
  readonly checksum: { readonly algorithm: 'sha256'; readonly value: string };
}

export type KnowledgeProcessingFailureCode =
  | 'AUTHORIZATION_REVOKED'
  | 'DOCUMENT_VERSION_STALE'
  | 'UNSUPPORTED_DOCUMENT_TYPE'
  | 'OBJECT_NOT_FOUND'
  | 'CHECKSUM_MISMATCH'
  | 'FILE_TOO_LARGE'
  | 'NO_EXTRACTABLE_TEXT'
  | 'EXTRACTION_FAILED'
  | 'NORMALIZATION_LIMIT_EXCEEDED'
  | 'TOO_MANY_CHUNKS'
  | 'EMBEDDING_PROVIDER_UNAVAILABLE'
  | 'EMBEDDING_PROVIDER_INVALID_RESPONSE'
  | 'EMBEDDING_DIMENSION_MISMATCH'
  | 'PROCESSING_TIMEOUT'
  | 'PERSISTENCE_FAILED';

export interface KnowledgeDocumentProcessingStartV1 {
  readonly type: 'knowledge.document.processing.start';
  readonly version: 1;
  readonly job: KnowledgeDocumentIngestionRequestedV1;
  readonly normalizationVersion: number;
  readonly chunkingVersion: number;
  readonly chunkSize: number;
  readonly chunkOverlap: number;
  readonly embeddingProvider: string;
  readonly embeddingModel: string;
  readonly embeddingDimension: number;
  readonly embeddingConfigVersion: number;
}

/** Bounded, short-lived input issued by Knowledge after current-state revalidation. */
export interface KnowledgeDocumentProcessingInputV1 {
  readonly type: 'knowledge.document.processing.input';
  readonly version: 1;
  readonly job: KnowledgeDocumentIngestionRequestedV1['job'];
  readonly organizationId: string;
  readonly knowledgeBaseId: string;
  readonly sourceId: string;
  readonly documentId: string;
  readonly documentVersionId: string;
  readonly mimeType: string;
  readonly size: number;
  readonly checksum: { readonly algorithm: 'sha256'; readonly value: string };
  readonly download: { readonly url: string; readonly expiresAt: string };
}

export interface KnowledgeDocumentProcessingChunkV1 {
  readonly chunkIndex: number;
  readonly content: string;
  readonly contentChecksum: string;
  readonly sectionReference?: string;
  readonly pageNumber?: number;
  readonly embedding: readonly number[];
  readonly embeddingProvider: string;
  readonly embeddingModel: string;
  readonly embeddingDimension: number;
  readonly embeddingConfigVersion: number;
}

export interface KnowledgeDocumentProcessingBatchV1 {
  readonly type: 'knowledge.document.processing.batch';
  readonly version: 1;
  readonly jobId: string;
  readonly organizationId: string;
  readonly documentVersionId: string;
  readonly normalizationVersion: number;
  readonly chunkingVersion: number;
  readonly chunks: readonly KnowledgeDocumentProcessingChunkV1[];
}

export interface KnowledgeDocumentProcessingCompletionV1 {
  readonly type: 'knowledge.document.processing.completed';
  readonly version: 1;
  readonly jobId: string;
  readonly organizationId: string;
  readonly documentVersionId: string;
  readonly expectedChunkCount: number;
}

export interface KnowledgeDocumentProcessingFailureV1 {
  readonly type: 'knowledge.document.processing.failed';
  readonly version: 1;
  readonly jobId: string;
  readonly organizationId: string;
  readonly documentVersionId: string;
  readonly code: KnowledgeProcessingFailureCode;
}

/** Evidence returned by Knowledge after tenant and resource filtering. */
export interface KnowledgeRetrievalResultV1 {
  readonly chunkId: string;
  readonly organizationId: string;
  readonly knowledgeBaseId: string;
  readonly sourceId: string;
  readonly documentId: string;
  readonly documentVersionId: string;
  readonly documentTitle: string;
  readonly chunkIndex: number;
  readonly content: string;
  readonly contentChecksum: string;
  readonly sectionReference: string | null;
  readonly pageNumber: number | null;
  /** Cosine similarity (1 - cosine distance), not a confidence value. */
  readonly similarityScore: number;
  readonly citation: {
    readonly knowledgeBaseId: string;
    readonly sourceId: string;
    readonly documentId: string;
    readonly documentVersionId: string;
    readonly chunkId: string;
  };
}

export interface KnowledgeRetrievalResponseV1 {
  readonly type: 'knowledge.retrieval.results';
  readonly version: 1;
  readonly retrievalProfile: {
    readonly provider: string;
    readonly model: string;
    readonly dimension: number;
    readonly configVersion: number;
    readonly metric: 'cosine';
  };
  readonly results: readonly KnowledgeRetrievalResultV1[];
}
