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
/** Pending durable intent only; transport and worker are not implemented. */
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
