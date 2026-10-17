import { Injectable, Logger } from '@nestjs/common';
import type {
  KnowledgeRagCitationV1,
  KnowledgeRagRequestV1,
  KnowledgeRagResponseV1,
} from '@amani/contracts';
import type { Actor } from '../common/context';
import { orchestratorConfig } from '../common/config';
import { CorePolicyClient } from '../clients/core-policy.client';
import { KnowledgeRetrievalClient } from '../clients/knowledge-retrieval.client';
import { GenerationProvider } from '../generation/generation.provider';
import { buildEvidenceContext } from './evidence-context';
import type { Evidence } from './evidence-context';
import { KnowledgeRagPromptBuilder } from './prompt-builder';

const insufficientAnswer =
  'The available authorized sources do not contain enough information to answer this question.';

@Injectable()
export class KnowledgeRagService {
  private readonly config = orchestratorConfig();
  private readonly logger = new Logger(KnowledgeRagService.name);

  constructor(
    private readonly core: CorePolicyClient,
    private readonly knowledge: KnowledgeRetrievalClient,
    private readonly prompts: KnowledgeRagPromptBuilder,
    private readonly generation: GenerationProvider,
  ) {}

  async answer(
    actor: Actor,
    request: KnowledgeRagRequestV1,
  ): Promise<KnowledgeRagResponseV1> {
    const started = Date.now();
    await this.core.assertKnowledgeCapability(actor);
    const retrieval = await this.knowledge.retrieve(actor, {
      question: request.question,
      ...(request.knowledgeBaseId
        ? { knowledgeBaseId: request.knowledgeBaseId }
        : {}),
      topK: Math.min(
        request.topK ?? this.config.rag.defaultTopK,
        this.config.rag.maxTopK,
      ),
      minSimilarityBps: Math.max(
        this.config.rag.minSimilarityBps,
        request.minSimilarityBps ?? 0,
      ),
    });
    const context = buildEvidenceContext(retrieval.results, {
      maxChunks: this.config.rag.maxEvidenceChunks,
      maxCharacters: this.config.rag.maxEvidenceCharacters,
    });
    if (!context.evidence.length) {
      const response = this.insufficient(
        actor,
        retrieval.results.length,
        context.evidence.length,
        retrieval.retrievalProfile,
        null,
      );
      this.audit(actor, response, started);
      return response;
    }
    const prompt = this.prompts.build(request.question, context.evidence);
    const generated = await this.generation.generate({
      prompt,
      evidenceIds: context.evidence.map((item) => item.evidenceId),
    });
    const citations = this.citations(context.evidence, generated.evidenceIds);
    if (!citations.length) {
      const response = this.insufficient(
        actor,
        retrieval.results.length,
        context.evidence.length,
        retrieval.retrievalProfile,
        this.generationMetadata(generated),
      );
      this.audit(actor, response, started);
      return response;
    }
    const response: KnowledgeRagResponseV1 = {
      type: 'knowledge.rag.answer',
      version: 1,
      status: 'answered',
      answer: generated.answer,
      citations,
      retrieval: {
        resultCount: retrieval.results.length,
        evidenceCount: context.evidence.length,
        profile: retrieval.retrievalProfile,
      },
      generation: this.generationMetadata(generated),
      requestId: actor.requestId,
      correlationId: actor.correlationId,
    };
    this.audit(actor, response, started);
    return response;
  }

  private citations(
    evidence: readonly Evidence[],
    selectedIds: readonly string[],
  ): readonly KnowledgeRagCitationV1[] {
    const byId = new Map(
      evidence.map((item) => [item.evidenceId, item.result]),
    );
    return [...new Set(selectedIds)].flatMap((evidenceId) => {
      const result = byId.get(evidenceId);
      if (!result) return [];
      return [
        {
          citationId: evidenceId,
          evidenceId,
          knowledgeBaseId: result.citation.knowledgeBaseId,
          sourceId: result.citation.sourceId,
          documentId: result.citation.documentId,
          documentVersionId: result.citation.documentVersionId,
          documentTitle: result.documentTitle,
          chunkId: result.citation.chunkId,
          chunkIndex: result.chunkIndex,
          pageNumber: result.pageNumber,
          sectionReference: result.sectionReference,
        },
      ];
    });
  }

  private insufficient(
    actor: Actor,
    resultCount: number,
    evidenceCount: number,
    profile: KnowledgeRagResponseV1['retrieval']['profile'],
    generation: KnowledgeRagResponseV1['generation'],
  ): KnowledgeRagResponseV1 {
    return {
      type: 'knowledge.rag.answer',
      version: 1,
      status: 'insufficient_evidence',
      answer: insufficientAnswer,
      citations: [],
      retrieval: { resultCount, evidenceCount, profile },
      generation,
      requestId: actor.requestId,
      correlationId: actor.correlationId,
    };
  }

  private generationMetadata(
    generation: Awaited<ReturnType<GenerationProvider['generate']>>,
  ): KnowledgeRagResponseV1['generation'] {
    return {
      provider: generation.provider,
      model: generation.model,
      promptProfile: 'knowledge-rag-v1',
      finishReason: generation.finishReason,
      ...(generation.inputTokens === undefined
        ? {}
        : { inputTokens: generation.inputTokens }),
      ...(generation.outputTokens === undefined
        ? {}
        : { outputTokens: generation.outputTokens }),
    };
  }

  private audit(
    actor: Actor,
    response: KnowledgeRagResponseV1,
    started: number,
  ) {
    this.logger.log({
      event: 'knowledge_rag.completed',
      requestId: actor.requestId,
      correlationId: actor.correlationId,
      organizationId: actor.organizationId,
      status: response.status,
      retrievalResultCount: response.retrieval.resultCount,
      evidenceCount: response.retrieval.evidenceCount,
      citationCount: response.citations.length,
      provider: response.generation?.provider,
      model: response.generation?.model,
      durationMs: Date.now() - started,
    });
  }
}
