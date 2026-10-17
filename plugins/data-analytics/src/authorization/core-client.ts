import { createHash, createHmac, randomUUID } from 'node:crypto';
import {
  BadGatewayException,
  ForbiddenException,
  GatewayTimeoutException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type {
  CoreAuthorizationDecision,
  DataAnalysisAuthorizationRequest,
  DataAnalysisAuthorizationResponse,
} from '@amani/contracts';
import { isUUID } from 'class-validator';
import type { Actor } from '../common/context';
import { analyticsConfig } from '../common/config';

function validDecision(value: unknown): value is CoreAuthorizationDecision {
  if (!value || typeof value !== 'object') return false;
  const decision = value as Record<string, unknown>;
  return (
    typeof decision.allowed === 'boolean' &&
    typeof decision.organizationId === 'string' &&
    isUUID(decision.organizationId) &&
    typeof decision.userId === 'string' &&
    isUUID(decision.userId) &&
    typeof decision.permission === 'string' &&
    ['ROLE_PERMISSION', 'INACTIVE_CONTEXT', 'MISSING_PERMISSION', 'PLUGIN_UNAVAILABLE', 'WRONG_ORGANIZATION'].includes(decision.reason as string)
  );
}
export function isDataAnalysisAuthorizationResponse(
  value: unknown,
): value is DataAnalysisAuthorizationResponse {
  if (!value || typeof value !== 'object') return false;
  const response = value as Record<string, unknown>;
  return (
    typeof response.membershipId === 'string' &&
    isUUID(response.membershipId) &&
    validDecision(response.decision)
  );
}
@Injectable()
export class CorePolicyClient {
  private readonly config = analyticsConfig();
  async authorize(
    actor: Actor,
    request: DataAnalysisAuthorizationRequest,
  ): Promise<DataAnalysisAuthorizationResponse> {
    if (!this.config.coreDevelopmentSecret)
      throw new ServiceUnavailableException();
    const body = JSON.stringify(request);
    const now = Date.now();
    const payload = {
      version: 1 as const,
      userId: actor.userId,
      organizationId: request.organizationId,
      requestId: randomUUID(),
      correlationId: actor.correlationId,
      callingService: '@amani/data-analytics' as const,
      audience: '@amani/core-api' as const,
      scope: { action: 'authorization.check', resourceType: 'policy' },
      issuedAt: now,
      expiresAt: now + 30_000,
      nonce: randomUUID(),
      method: 'POST' as const,
      path: '/internal/data-analytics/authorization',
      bodySha256: createHash('sha256').update(body).digest('hex'),
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac(
      'sha256',
      Buffer.from(this.config.coreDevelopmentSecret, 'hex'),
    )
      .update(encoded)
      .digest('hex');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.coreTimeoutMs);
    try {
      const response = await fetch(
        new URL('/internal/data-analytics/authorization', this.config.coreUrl),
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-request-id': payload.requestId,
            'x-correlation-id': payload.correlationId,
            'x-amani-development-context': encoded,
            'x-amani-development-signature': signature,
          },
          body,
          signal: controller.signal,
        },
      );
      if (response.status === 403) throw new ForbiddenException();
      if (!response.ok) throw new ServiceUnavailableException();
      const data: unknown = await response.json();
      if (
        !isDataAnalysisAuthorizationResponse(data) ||
        data.decision.organizationId !== request.organizationId ||
        data.decision.userId !== actor.userId ||
        data.decision.permission !== request.permission ||
        !data.decision.allowed
      )
        throw new BadGatewayException();
      return data;
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof BadGatewayException ||
        error instanceof ServiceUnavailableException
      )
        throw error;
      if (error instanceof Error && error.name === 'AbortError')
        throw new GatewayTimeoutException();
      throw new ServiceUnavailableException();
    } finally {
      clearTimeout(timer);
    }
  }
}
