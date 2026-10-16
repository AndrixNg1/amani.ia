import { BadRequestException, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type {
  KnowledgeRetrievalResponseV1,
  KnowledgeRetrievalResultV1,
} from '@amani/contracts';
import type { Actor } from '../common/context';
import { knowledgeConfig } from '../common/config';
import { DatabaseService } from '../database/database';
import { ResourcePolicy } from '../authorization/resource-policy';
import { RetrievalEmbeddingProvider } from './retrieval.embedding';

type RetrievalRow = {
  chunk_id: string;
  organization_id: string;
  knowledge_base_id: string;
  source_id: string;
  document_id: string;
  document_version_id: string;
  document_title: string;
  chunk_index: number;
  content: string;
  content_checksum: string;
  section_reference: string | null;
  page_number: number | null;
  similarity_score: number | string;
};

function vectorLiteral(vector: readonly number[]): string {
  if (!vector.length || vector.some((component) => !Number.isFinite(component)))
    throw new Error('Invalid query embedding');
  return `[${vector.join(',')}]`;
}

@Injectable()
export class RetrievalService {
  private readonly config = knowledgeConfig().retrieval;
  constructor(
    private readonly database: DatabaseService,
    private readonly policy: ResourcePolicy,
    private readonly embedding: RetrievalEmbeddingProvider,
  ) {}

  async retrieve(
    actor: Actor,
    request: {
      readonly organizationId: string;
      readonly query: string;
      readonly knowledgeBaseId?: string;
      readonly topK?: number;
      readonly minSimilarityBps?: number;
    },
  ): Promise<KnowledgeRetrievalResponseV1> {
    const query = request.query.trim();
    if (!query || query.length > this.config.maxQueryCharacters)
      throw new BadRequestException();
    const topK = request.topK ?? this.config.defaultTopK;
    if (topK > this.config.maxTopK) throw new BadRequestException();
    const threshold = Math.max(
      this.config.minSimilarityBps,
      request.minSimilarityBps ?? 0,
    ) / 10_000;
    // Core revalidates membership, permission, entitlement and installation first.
    const core = await this.policy.coreAuthorize(
      actor,
      request.organizationId,
      'read',
    );
    const profile = this.embedding.profile();
    const vector = vectorLiteral(await this.embedding.embedQuery(query));
    const rows = await this.database.db.execute<RetrievalRow>(sql`
      SELECT c.id AS chunk_id,c.organization_id,c.knowledge_base_id,c.source_id,
        c.document_id,c.document_version_id,d.title AS document_title,c.chunk_index,
        c.content,c.content_checksum,c.section_reference,c.page_number,
        (1 - (c.embedding <=> ${vector}::extensions.vector))::double precision AS similarity_score
      FROM knowledge.document_chunks c
      JOIN knowledge.documents d
        ON d.organization_id=c.organization_id AND d.id=c.document_id
        AND d.knowledge_base_id=c.knowledge_base_id AND d.source_id=c.source_id
      JOIN knowledge.knowledge_bases b
        ON b.organization_id=d.organization_id AND b.id=d.knowledge_base_id
      JOIN knowledge.knowledge_sources s
        ON s.organization_id=d.organization_id AND s.id=d.source_id
        AND s.knowledge_base_id=d.knowledge_base_id
      JOIN knowledge.document_versions v
        ON v.organization_id=c.organization_id AND v.id=c.document_version_id
        AND v.document_id=c.document_id
      WHERE c.organization_id=${request.organizationId}
        AND (${request.knowledgeBaseId ?? null}::uuid IS NULL
          OR c.knowledge_base_id=${request.knowledgeBaseId ?? null}::uuid)
        AND b.status='active' AND s.status='active' AND d.status='active'
        AND v.processing_status='ready'
        AND v.version=(SELECT max(current_version.version)
          FROM knowledge.document_versions current_version
          WHERE current_version.organization_id=v.organization_id
            AND current_version.document_id=v.document_id)
        AND c.embedding_provider=${profile.provider}
        AND c.embedding_model=${profile.model}
        AND c.embedding_dimension=${profile.dimension}
        AND c.embedding_config_version=${profile.configVersion}
        AND EXISTS (SELECT 1 FROM knowledge.resource_grants base_grant
          WHERE base_grant.organization_id=c.organization_id
            AND base_grant.resource_type='knowledge_base'
            AND base_grant.resource_id=c.knowledge_base_id
            AND base_grant.membership_id=${core.membershipId}
            AND base_grant.action='read')
        AND (d.access_mode='inherit' OR EXISTS (
          SELECT 1 FROM knowledge.resource_grants document_grant
          WHERE document_grant.organization_id=c.organization_id
            AND document_grant.resource_type='document'
            AND document_grant.resource_id=c.document_id
            AND document_grant.membership_id=${core.membershipId}
            AND document_grant.action='read'))
        AND (1 - (c.embedding <=> ${vector}::extensions.vector)) >= ${threshold}
      ORDER BY c.embedding <=> ${vector}::extensions.vector ASC,c.id ASC
      LIMIT ${topK}
    `);
    const results: KnowledgeRetrievalResultV1[] = rows.rows.map((row) => ({
      chunkId: row.chunk_id,
      organizationId: row.organization_id,
      knowledgeBaseId: row.knowledge_base_id,
      sourceId: row.source_id,
      documentId: row.document_id,
      documentVersionId: row.document_version_id,
      documentTitle: row.document_title,
      chunkIndex: row.chunk_index,
      content: row.content,
      contentChecksum: row.content_checksum,
      sectionReference: row.section_reference,
      pageNumber: row.page_number,
      similarityScore: Number(row.similarity_score),
      citation: {
        knowledgeBaseId: row.knowledge_base_id,
        sourceId: row.source_id,
        documentId: row.document_id,
        documentVersionId: row.document_version_id,
        chunkId: row.chunk_id,
      },
    }));
    return {
      type: 'knowledge.retrieval.results',
      version: 1,
      retrievalProfile: profile,
      results,
    };
  }
}
