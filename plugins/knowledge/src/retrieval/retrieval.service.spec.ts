import type { KnowledgeAuthorizationResponse } from '@amani/contracts';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import type {
  CorrelationId,
  OrganizationId,
  RequestId,
  UserId,
} from '@amani/types';
import type { Actor } from '../common/context';
import type { DatabaseService } from '../database/database';
import type { ResourcePolicy } from '../authorization/resource-policy';
import type {
  RetrievalEmbeddingProfile,
  RetrievalEmbeddingProvider,
} from './retrieval.embedding';
import { RetrievalService } from './retrieval.service';

type ExecuteMock = jest.Mock<Promise<{ rows: readonly unknown[] }>, [SQL]>;
type PolicyMock = {
  readonly coreAuthorize: jest.Mock<
    Promise<KnowledgeAuthorizationResponse>,
    [Actor, string, 'read']
  >;
};
type EmbeddingMock = {
  readonly profile: jest.Mock<RetrievalEmbeddingProfile, []>;
  readonly embedQuery: jest.Mock<Promise<readonly number[]>, [string]>;
};

jest.mock('../common/config', () => ({
  knowledgeConfig: () => ({
    retrieval: {
      maxQueryCharacters: 2000,
      defaultTopK: 6,
      maxTopK: 20,
      minSimilarityBps: 0,
      embedding: {
        provider: 'deterministic-test',
        model: 'deterministic-v1',
        dimension: 3,
        configVersion: 1,
        timeoutMs: 1000,
      },
    },
  }),
}));

const organizationA = '00000000-0000-4000-8000-000000000010' as OrganizationId;
const organizationB = '00000000-0000-4000-8000-000000000020' as OrganizationId;
const actor: Actor = {
  userId: '00000000-0000-4000-8000-000000000001' as UserId,
  organizationId: organizationA,
  requestId: '00000000-0000-4000-8000-000000000011' as RequestId,
  correlationId: '00000000-0000-4000-8000-000000000012' as CorrelationId,
};
const profile: RetrievalEmbeddingProfile = {
  provider: 'deterministic-test',
  model: 'deterministic-v1',
  dimension: 3,
  configVersion: 1,
  metric: 'cosine' as const,
};
const authorization: KnowledgeAuthorizationResponse = {
  membershipId: '00000000-0000-4000-8000-000000000013',
  decision: {
    allowed: true,
    organizationId: organizationA,
    userId: actor.userId,
    permission: 'knowledge.documents.read',
    reason: 'ROLE_PERMISSION',
  },
};

function serviceWith(rows: readonly unknown[] = []) {
  const execute: ExecuteMock = jest.fn<
    Promise<{ rows: readonly unknown[] }>,
    [SQL]
  >(() => Promise.resolve({ rows }));
  const database = { db: { execute } } as unknown as DatabaseService;
  const policy: PolicyMock = {
    coreAuthorize: jest.fn<
      Promise<KnowledgeAuthorizationResponse>,
      [Actor, string, 'read']
    >(() => Promise.resolve(authorization)),
  };
  const embedding: EmbeddingMock = {
    profile: jest.fn<RetrievalEmbeddingProfile, []>(() => profile),
    embedQuery: jest.fn<Promise<readonly number[]>, [string]>(() =>
      Promise.resolve([1, 0, 0]),
    ),
  };
  return {
    service: new RetrievalService(
      database,
      policy as unknown as ResourcePolicy,
      embedding as unknown as RetrievalEmbeddingProvider,
    ),
    execute,
    policy,
    embedding,
  };
}

describe('secure Knowledge retrieval', () => {
  it('obtains Core membership before embedding or querying candidates', async () => {
    const { service, policy, embedding, execute } = serviceWith();
    await service.retrieve(actor, {
      organizationId: organizationA,
      query: 'salary policy',
    });
    expect(policy.coreAuthorize).toHaveBeenCalledWith(
      actor,
      organizationA,
      'read',
    );
    expect(embedding.embedQuery).toHaveBeenCalledWith('salary policy');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('returns only provenance-bound rows supplied by the authorization-scoped query', async () => {
    const { service } = serviceWith([
      {
        chunk_id: '00000000-0000-4000-8000-000000000101',
        organization_id: organizationA,
        knowledge_base_id: '00000000-0000-4000-8000-000000000102',
        source_id: '00000000-0000-4000-8000-000000000103',
        document_id: '00000000-0000-4000-8000-000000000104',
        document_version_id: '00000000-0000-4000-8000-000000000105',
        document_title: 'Employee handbook',
        chunk_index: 2,
        content: 'Compensation reviews are annual.',
        content_checksum: 'a'.repeat(64),
        section_reference: 'Compensation',
        page_number: 12,
        similarity_score: 0.92,
      },
    ]);
    const response = await service.retrieve(
      actor,
      {
        organizationId: organizationA,
        query: 'compensation reviews',
        topK: 2,
      },
    );
    expect(response.results[0]).toMatchObject({
      organizationId: organizationA,
      documentVersionId: '00000000-0000-4000-8000-000000000105',
      citation: { chunkId: '00000000-0000-4000-8000-000000000101' },
    });
  });

  it('fails closed before embedding or SQL when Core rejects another organization', async () => {
    const { service, policy, embedding, execute } = serviceWith();
    policy.coreAuthorize.mockRejectedValueOnce(new Error('denied'));
    await expect(
      service.retrieve(actor, {
        organizationId: organizationB,
        query: 'salary',
      }),
    ).rejects.toThrow('denied');
    expect(embedding.embedQuery).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects a top-K over the service maximum before Core or SQL is called', async () => {
    const { service, policy, embedding, execute } = serviceWith();
    await expect(
      service.retrieve(actor, {
        organizationId: organizationA,
        query: 'salary',
        topK: 21,
      }),
    ).rejects.toThrow('Bad Request');
    expect(policy.coreAuthorize).not.toHaveBeenCalled();
    expect(embedding.embedQuery).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('constructs the vector query with authorization and lifecycle scope before ranking', async () => {
    const { service, execute } = serviceWith();
    await service.retrieve(actor, {
      organizationId: organizationA,
      knowledgeBaseId: '00000000-0000-4000-8000-000000000102',
      query: 'compensation reviews',
    });
    const statement = execute.mock.calls[0]?.[0];
    if (!statement) throw new Error('Expected retrieval SQL statement');
    const query = new PgDialect().sqlToQuery(statement);
    expect(query.sql).toContain('c.organization_id=$');
    expect(query.sql).toContain("b.status='active'");
    expect(query.sql).toContain("v.processing_status='ready'");
    expect(query.sql).toContain('current_version.document_id=v.document_id');
    expect(query.sql).toContain('c.embedding_dimension=$');
    expect(query.sql).toContain('knowledge.resource_grants base_grant');
    expect(query.sql).toContain('knowledge.resource_grants document_grant');
    expect(query.sql).toContain("d.access_mode='inherit'");
    expect(query.sql).toContain('ORDER BY c.embedding <=>');
  });

  it('does not query chunks when compatible query embedding fails', async () => {
    const { service, embedding, execute } = serviceWith();
    embedding.embedQuery.mockRejectedValueOnce(
      new Error('embedding unavailable'),
    );
    await expect(
      service.retrieve(actor, {
        organizationId: organizationA,
        query: 'salary policy',
      }),
    ).rejects.toThrow('embedding unavailable');
    expect(execute).not.toHaveBeenCalled();
  });
});
