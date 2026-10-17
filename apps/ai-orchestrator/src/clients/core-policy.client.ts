import {
  BadGatewayException,
  ForbiddenException,
  GatewayTimeoutException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { CoreAuthorizationDecision } from '@amani/contracts';
import type { Actor } from '../common/context';
import { orchestratorConfig } from '../common/config';
import { signedHeaders } from './service-authentication';

function isDecision(value: unknown): value is CoreAuthorizationDecision {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const decision = value as Record<string, unknown>;
  return (
    typeof decision.allowed === 'boolean' &&
    isUUID(decision.organizationId) &&
    isUUID(decision.userId) &&
    typeof decision.permission === 'string' &&
    [
      'ROLE_PERMISSION',
      'INACTIVE_CONTEXT',
      'MISSING_PERMISSION',
      'PLUGIN_UNAVAILABLE',
      'WRONG_ORGANIZATION',
    ].includes(decision.reason as string)
  );
}

@Injectable()
export class CorePolicyClient {
  private readonly config = orchestratorConfig();

  async assertKnowledgeCapability(
    actor: Actor,
  ): Promise<CoreAuthorizationDecision> {
    const path = '/internal/authorization/check';
    const body = JSON.stringify({
      organizationId: actor.organizationId,
      permission: 'plugins.use',
      pluginKey: 'knowledge',
    });
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.config.coreTimeoutMs,
    );
    try {
      const response = await fetch(this.config.coreUrl + path, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          ...signedHeaders(actor, this.config.coreSecret, {
            audience: '@amani/core-api',
            method: 'POST',
            path,
            body,
            scope: {
              action: 'authorization.check',
              resourceType: 'policy',
              plugin: 'knowledge',
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
        !isDecision(data) ||
        !data.allowed ||
        data.organizationId !== actor.organizationId ||
        data.userId !== actor.userId ||
        data.permission !== 'plugins.use'
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
