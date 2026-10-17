import {
  createParamDecorator,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthorizationScope } from '@amani/contracts';
import type {
  CorrelationId,
  OrganizationId,
  RequestId,
  ServiceName,
  UserId,
} from '@amani/types';
import type { Request } from 'express';

export interface Actor {
  readonly userId: UserId;
  readonly organizationId: OrganizationId;
  readonly requestId: RequestId;
  readonly correlationId: CorrelationId;
}

export interface VerifiedIdentity {
  readonly userId: UserId;
  readonly organizationId: OrganizationId;
  readonly callingService: ServiceName;
  readonly audience: '@amani/ai-orchestrator';
  readonly scope: AuthorizationScope;
  readonly expiresAt: string;
}

export type OrchestratorRequest = Request & {
  actor?: Actor;
  identity?: VerifiedIdentity;
  requestId?: RequestId;
  correlationId?: CorrelationId;
};

@Injectable()
export class IdentityVerifier {
  verify(_request: Request): Promise<VerifiedIdentity | null> {
    void _request;
    return Promise.resolve(null);
  }
}

export const Public = () => SetMetadata('orchestrator.public', true);
export const Operation = (action: string, resourceType: string) =>
  SetMetadata('orchestrator.operation', { action, resourceType });

export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Actor => {
    const actor = context
      .switchToHttp()
      .getRequest<OrchestratorRequest>().actor;
    if (!actor) throw new ForbiddenException();
    return actor;
  },
);

@Injectable()
export class TrustedIdentityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: IdentityVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.get<boolean>('orchestrator.public', context.getHandler())) {
      return true;
    }
    const request = context
      .switchToHttp()
      .getRequest<OrchestratorRequest>();
    const operation = this.reflector.get<{
      action: string;
      resourceType: string;
    }>('orchestrator.operation', context.getHandler());
    const identity = await this.verifier.verify(request);
    const organizationId = this.requestOrganizationId(request);
    if (
      !identity ||
      !operation ||
      identity.audience !== '@amani/ai-orchestrator' ||
      !(Date.parse(identity.expiresAt) > Date.now()) ||
      identity.scope.action !== operation.action ||
      identity.scope.resourceType !== operation.resourceType ||
      !request.requestId ||
      !request.correlationId ||
      !organizationId ||
      organizationId !== identity.organizationId
    ) {
      throw new ForbiddenException();
    }
    request.identity = identity;
    request.actor = {
      userId: identity.userId,
      organizationId: identity.organizationId,
      requestId: request.requestId,
      correlationId: request.correlationId,
    };
    return true;
  }

  private requestOrganizationId(
    request: OrchestratorRequest,
  ): string | undefined {
    const body = request.body as { organizationId?: unknown } | undefined;
    return typeof body?.organizationId === 'string'
      ? body.organizationId
      : undefined;
  }
}
