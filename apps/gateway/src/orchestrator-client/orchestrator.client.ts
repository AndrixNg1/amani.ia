import {
  BadGatewayException,
  ForbiddenException,
  GatewayTimeoutException,
  HttpException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type {
  KnowledgeRagCitationV1,
  KnowledgeRagRequestV1,
  KnowledgeRagResponseV1,
} from '@amani/contracts';
import { GATEWAY_CONFIG } from '../config/gateway.config';
import type { GatewayConfig } from '../config/gateway.config';
import type { RequestContext } from '../common/context';
import { SafeLogger } from '../common/logging';
import { ServiceAuthentication } from '../core-client/service-authentication';

function citation(value: unknown): value is KnowledgeRagCitationV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    [
      'citationId',
      'evidenceId',
      'knowledgeBaseId',
      'sourceId',
      'documentId',
      'documentVersionId',
      'documentTitle',
      'chunkId',
    ].every((key) => typeof item[key] === 'string') &&
    typeof item.chunkIndex === 'number' &&
    (typeof item.pageNumber === 'number' || item.pageNumber === null) &&
    (typeof item.sectionReference === 'string' ||
      item.sectionReference === null)
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isRetrieval(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const profile = item.profile;
  return (
    isNonNegativeInteger(item.resultCount) &&
    isNonNegativeInteger(item.evidenceCount) &&
    (profile === null ||
      (!!profile &&
        typeof profile === 'object' &&
        !Array.isArray(profile) &&
        typeof (profile as Record<string, unknown>).provider === 'string' &&
        typeof (profile as Record<string, unknown>).model === 'string' &&
        isNonNegativeInteger((profile as Record<string, unknown>).dimension) &&
        isNonNegativeInteger(
          (profile as Record<string, unknown>).configVersion,
        ) &&
        (profile as Record<string, unknown>).metric === 'cosine'))
  );
}

function isGeneration(value: unknown): boolean {
  if (value === null) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.provider === 'string' &&
    typeof item.model === 'string' &&
    item.promptProfile === 'knowledge-rag-v1' &&
    (typeof item.finishReason === 'string' || item.finishReason === null) &&
    (item.inputTokens === undefined ||
      isNonNegativeInteger(item.inputTokens)) &&
    (item.outputTokens === undefined || isNonNegativeInteger(item.outputTokens))
  );
}

function isAnswer(value: unknown): value is KnowledgeRagResponseV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const response = value as Record<string, unknown>;
  const retrieval = response.retrieval;
  return (
    response.type === 'knowledge.rag.answer' &&
    response.version === 1 &&
    (response.status === 'answered' ||
      response.status === 'insufficient_evidence') &&
    typeof response.answer === 'string' &&
    Array.isArray(response.citations) &&
    response.citations.every(citation) &&
    isRetrieval(retrieval) &&
    isGeneration(response.generation) &&
    typeof response.requestId === 'string' &&
    typeof response.correlationId === 'string'
  );
}

function answer(value: unknown): KnowledgeRagResponseV1 {
  if (!isAnswer(value)) throw new BadGatewayException();
  return value;
}

@Injectable()
export class OrchestratorClient {
  constructor(
    @Inject(GATEWAY_CONFIG) private readonly config: GatewayConfig,
    private readonly auth: ServiceAuthentication,
    private readonly logger: SafeLogger,
  ) {}

  async ask(
    context: RequestContext,
    request: Omit<KnowledgeRagRequestV1, 'organizationId'>,
  ): Promise<KnowledgeRagResponseV1> {
    if (!context.organizationId) throw new ForbiddenException();
    const path = '/ai/knowledge-rag';
    const body = JSON.stringify({
      organizationId: context.organizationId,
      ...request,
    });
    const started = Date.now();
    let status = 503;
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.config.orchestratorTimeoutMs,
    );
    try {
      const response = await fetch(this.config.orchestratorBaseUrl + path, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          ...this.auth.headers(context, {
            audience: '@amani/ai-orchestrator',
            method: 'POST',
            path,
            body,
            scope: {
              action: 'ai.knowledge-rag.ask',
              resourceType: 'knowledge',
            },
          }),
        },
        body,
        signal: controller.signal,
        redirect: 'manual',
      });
      if (response.status === 403) throw new ForbiddenException();
      if (!response.ok) throw new ServiceUnavailableException();
      const text = await response.text();
      if (
        Buffer.byteLength(text, 'utf8') >
        this.config.orchestratorMaxResponseBytes
      ) {
        throw new BadGatewayException();
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new BadGatewayException();
      }
      status = response.status;
      return answer(parsed);
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof BadGatewayException ||
        error instanceof ServiceUnavailableException
      ) {
        status = error.getStatus();
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        status = 504;
        throw new GatewayTimeoutException();
      }
      if (error instanceof HttpException) {
        status = error.getStatus();
        throw error;
      }
      throw new ServiceUnavailableException();
    } finally {
      clearTimeout(timer);
      this.logger.core(
        context,
        'knowledge-rag.ask',
        status,
        Date.now() - started,
      );
    }
  }
}
