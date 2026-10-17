import {
  BadGatewayException,
  ForbiddenException,
  GatewayTimeoutException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import type {
  KnowledgeRetrievalResponseV1,
  KnowledgeRetrievalResultV1,
} from '@amani/contracts';
import type { ResourceId } from '@amani/types';
import type { Actor } from '../common/context';
import { orchestratorConfig } from '../common/config';
import { signedHeaders } from './service-authentication';

function isResult(value: unknown): value is KnowledgeRetrievalResultV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  const citation = result.citation;
  const citationRecord =
    citation && typeof citation === 'object' && !Array.isArray(citation)
      ? (citation as Record<string, unknown>)
      : undefined;
  return (
    [
      'chunkId',
      'organizationId',
      'knowledgeBaseId',
      'sourceId',
      'documentId',
      'documentVersionId',
    ].every((key) => isUUID(result[key])) &&
    typeof result.documentTitle === 'string' &&
    typeof result.chunkIndex === 'number' &&
    typeof result.content === 'string' &&
    typeof result.contentChecksum === 'string' &&
    (typeof result.sectionReference === 'string' ||
      result.sectionReference === null) &&
    (typeof result.pageNumber === 'number' || result.pageNumber === null) &&
    typeof result.similarityScore === 'number' &&
    Number.isFinite(result.similarityScore) &&
    !!citationRecord &&
    [
      'knowledgeBaseId',
      'sourceId',
      'documentId',
      'documentVersionId',
      'chunkId',
    ].every((key) => isUUID(citationRecord[key])) &&
    citationRecord.knowledgeBaseId === result.knowledgeBaseId &&
    citationRecord.sourceId === result.sourceId &&
    citationRecord.documentId === result.documentId &&
    citationRecord.documentVersionId === result.documentVersionId &&
    citationRecord.chunkId === result.chunkId
  );
}

export function isKnowledgeRetrievalResponse(
  value: unknown,
): value is KnowledgeRetrievalResponseV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const response = value as Record<string, unknown>;
  const profile = response.retrievalProfile;
  return (
    response.type === 'knowledge.retrieval.results' &&
    response.version === 1 &&
    !!profile &&
    typeof profile === 'object' &&
    !Array.isArray(profile) &&
    typeof (profile as Record<string, unknown>).provider === 'string' &&
    typeof (profile as Record<string, unknown>).model === 'string' &&
    typeof (profile as Record<string, unknown>).dimension === 'number' &&
    typeof (profile as Record<string, unknown>).configVersion === 'number' &&
    (profile as Record<string, unknown>).metric === 'cosine' &&
    Array.isArray(response.results) &&
    response.results.every(isResult)
  );
}

@Injectable()
export class KnowledgeRetrievalClient {
  private readonly config = orchestratorConfig();

  async retrieve(
    actor: Actor,
    request: {
      readonly question: string;
      readonly knowledgeBaseId?: string;
      readonly topK: number;
      readonly minSimilarityBps: number;
    },
  ): Promise<KnowledgeRetrievalResponseV1> {
    const path = '/knowledge/retrieval';
    const body = JSON.stringify({
      organizationId: actor.organizationId,
      query: request.question,
      ...(request.knowledgeBaseId
        ? { knowledgeBaseId: request.knowledgeBaseId }
        : {}),
      topK: request.topK,
      minSimilarityBps: request.minSimilarityBps,
    });
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.config.knowledgeTimeoutMs,
    );
    try {
      const response = await fetch(this.config.knowledgeUrl + path, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          ...signedHeaders(actor, this.config.knowledgeSecret, {
            audience: '@amani/knowledge',
            method: 'POST',
            path,
            body,
            scope: {
              action: 'knowledge.documents.read',
              resourceType: 'knowledge_base',
              ...(request.knowledgeBaseId
                ? { resourceId: request.knowledgeBaseId as ResourceId }
                : {}),
            },
          }),
        },
        body,
        signal: controller.signal,
        redirect: 'manual',
      });
      if (response.status === 403) throw new ForbiddenException();
      if (!response.ok) throw new ServiceUnavailableException();
      const data: unknown = await response.json();
      if (
        !isKnowledgeRetrievalResponse(data) ||
        data.results.some(
          (result) => result.organizationId !== actor.organizationId,
        )
      ) {
        throw new BadGatewayException();
      }
      return data;
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof BadGatewayException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new GatewayTimeoutException();
      }
      throw new ServiceUnavailableException();
    } finally {
      clearTimeout(timer);
    }
  }
}
