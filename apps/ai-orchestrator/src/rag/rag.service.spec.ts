import type {
  CoreAuthorizationDecision,
  KnowledgeRagRequestV1,
  KnowledgeRetrievalResponseV1,
} from '@amani/contracts';
import type { Actor } from '../common/context';
import type { CorePolicyClient } from '../clients/core-policy.client';
import type { KnowledgeRetrievalClient } from '../clients/knowledge-retrieval.client';
import type {
  GenerationRequest,
  GenerationResponse,
} from '../generation/generation.provider';
import { KnowledgeRagPromptBuilder } from './prompt-builder';
import { KnowledgeRagService } from './rag.service';

jest.mock('../common/config', () => ({
  orchestratorConfig: () => ({
    rag: {
      defaultTopK: 6,
      maxTopK: 8,
      minSimilarityBps: 0,
      maxEvidenceChunks: 6,
      maxEvidenceCharacters: 12000,
    },
  }),
}));

const organizationA = '00000000-0000-4000-8000-000000000010';
const actor = {
  userId: '00000000-0000-4000-8000-000000000011',
  organizationId: organizationA,
  requestId: '00000000-0000-4000-8000-000000000012',
  correlationId: '00000000-0000-4000-8000-000000000013',
} as Actor;
const request: KnowledgeRagRequestV1 = {
  organizationId: organizationA,
  question: 'How are annual compensation reviews handled?',
};

type CoreMock = {
  readonly assertKnowledgeCapability: jest.Mock<
    Promise<CoreAuthorizationDecision>,
    [Actor]
  >;
};
type KnowledgeMock = {
  readonly retrieve: jest.Mock<
    Promise<KnowledgeRetrievalResponseV1>,
    [Actor, Parameters<KnowledgeRetrievalClient['retrieve']>[1]]
  >;
};
type GenerationMock = {
  readonly generate: jest.Mock<
    Promise<GenerationResponse>,
    [GenerationRequest]
  >;
};
const allowed: CoreAuthorizationDecision = {
  allowed: true,
  organizationId: organizationA,
  userId: actor.userId,
  permission: 'plugins.use',
  reason: 'ROLE_PERMISSION',
};
const retrieval = (content: string): KnowledgeRetrievalResponseV1 => ({
  type: 'knowledge.retrieval.results',
  version: 1,
  retrievalProfile: {
    provider: 'deterministic-test',
    model: 'deterministic-v1',
    dimension: 16,
    configVersion: 1,
    metric: 'cosine',
  },
  results: [
    {
      chunkId: '00000000-0000-4000-8000-000000000101',
      organizationId: organizationA,
      knowledgeBaseId: '00000000-0000-4000-8000-000000000102',
      sourceId: '00000000-0000-4000-8000-000000000103',
      documentId: '00000000-0000-4000-8000-000000000104',
      documentVersionId: '00000000-0000-4000-8000-000000000105',
      documentTitle: 'Employee handbook',
      chunkIndex: 2,
      content,
      contentChecksum: 'a'.repeat(64),
      sectionReference: 'Compensation',
      pageNumber: 12,
      similarityScore: 0.92,
      citation: {
        knowledgeBaseId: '00000000-0000-4000-8000-000000000102',
        sourceId: '00000000-0000-4000-8000-000000000103',
        documentId: '00000000-0000-4000-8000-000000000104',
        documentVersionId: '00000000-0000-4000-8000-000000000105',
        chunkId: '00000000-0000-4000-8000-000000000101',
      },
    },
  ],
});

function serviceWith(response: KnowledgeRetrievalResponseV1) {
  const core: CoreMock = {
    assertKnowledgeCapability: jest.fn<
      Promise<CoreAuthorizationDecision>,
      [Actor]
    >(() => Promise.resolve(allowed)),
  };
  const knowledge: KnowledgeMock = {
    retrieve: jest.fn<
      Promise<KnowledgeRetrievalResponseV1>,
      [Actor, Parameters<KnowledgeRetrievalClient['retrieve']>[1]]
    >(() => Promise.resolve(response)),
  };
  const generation: GenerationMock = {
    generate: jest.fn<Promise<GenerationResponse>, [GenerationRequest]>(() =>
      Promise.resolve({
        answer: 'Annual compensation reviews are described in the handbook.',
        evidenceIds: ['E1'],
        provider: 'deterministic-test',
        model: 'deterministic-v1',
        finishReason: 'stop',
      }),
    ),
  };
  return {
    service: new KnowledgeRagService(
      core as unknown as CorePolicyClient,
      knowledge as unknown as KnowledgeRetrievalClient,
      new KnowledgeRagPromptBuilder(),
      generation,
    ),
    core,
    knowledge,
    generation,
  };
}

describe('KnowledgeRagService', () => {
  it('uses authorized evidence and creates citations from Knowledge provenance', async () => {
    const { service, generation } = serviceWith(
      retrieval('Compensation reviews are annual.'),
    );
    const answer = await service.answer(actor, request);
    expect(answer.status).toBe('answered');
    expect(answer.citations[0]).toMatchObject({
      evidenceId: 'E1',
      documentId: '00000000-0000-4000-8000-000000000104',
      pageNumber: 12,
    });
    expect(generation.generate).toHaveBeenCalledWith(
      expect.objectContaining({ evidenceIds: ['E1'] }),
    );
  });

  it('does not call generation when Knowledge returns no authorized evidence', async () => {
    const { service, generation } = serviceWith({
      ...retrieval('unused'),
      results: [],
    });
    const answer = await service.answer(actor, request);
    expect(answer.status).toBe('insufficient_evidence');
    expect(generation.generate).not.toHaveBeenCalled();
  });

  it('never turns a fabricated evidence ID into a citation', async () => {
    const { service, generation } = serviceWith(
      retrieval('Authorized handbook text.'),
    );
    generation.generate.mockResolvedValueOnce({
      answer: 'Fabricated reference.',
      evidenceIds: ['E99'],
      provider: 'deterministic-test',
      model: 'deterministic-v1',
      finishReason: 'stop',
    });
    const answer = await service.answer(actor, request);
    expect(answer.status).toBe('insufficient_evidence');
    expect(answer.citations).toEqual([]);
  });

  it('propagates a Core failure without generation fallback', async () => {
    const { service, core, generation } = serviceWith(retrieval('visible'));
    core.assertKnowledgeCapability.mockRejectedValueOnce(new Error('denied'));
    await expect(service.answer(actor, request)).rejects.toThrow('denied');
    expect(generation.generate).not.toHaveBeenCalled();
  });

  it('propagates a Knowledge failure without generation fallback', async () => {
    const { service, knowledge, generation } = serviceWith(
      retrieval('visible'),
    );
    knowledge.retrieve.mockRejectedValueOnce(
      new Error('knowledge unavailable'),
    );
    await expect(service.answer(actor, request)).rejects.toThrow(
      'knowledge unavailable',
    );
    expect(generation.generate).not.toHaveBeenCalled();
  });

  it('keeps an HR-only chunk out of Bob request because Knowledge never returned it', async () => {
    const { service, generation } = serviceWith(
      retrieval('Employee handbook: reviews are annual.'),
    );
    await service.answer(actor, request);
    const call = generation.generate.mock.calls[0]?.[0];
    expect(call?.prompt.userMessage).not.toContain('HR compensation policy');
  });
});
