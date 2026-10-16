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
  userId: UserId;
  organizationId?: OrganizationId;
  requestId: RequestId;
  correlationId: CorrelationId;
}
export interface VerifiedIdentity {
  userId: UserId;
  organizationId?: OrganizationId;
  callingService: ServiceName;
  audience: '@amani/knowledge';
  scope: AuthorizationScope;
  expiresAt: string;
}
export type KnowledgeRequest = Request & {
  actor?: Actor;
  identity?: VerifiedIdentity;
  correlationId?: CorrelationId;
  requestId?: string;
};
@Injectable()
export class IdentityVerifier {
  verify(request: Request): Promise<VerifiedIdentity | null> {
    void request;
    return Promise.resolve(null);
  }
}
export const Public = () => SetMetadata('knowledge.public', true);
export const Operation = (action: string, resourceType: string) =>
  SetMetadata('knowledge.operation', { action, resourceType });
export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Actor => {
    const actor = context.switchToHttp().getRequest<KnowledgeRequest>().actor;
    if (!actor) throw new ForbiddenException();
    return actor;
  },
);
export const CurrentIdentity = createParamDecorator(
  (_data: unknown, context: ExecutionContext): VerifiedIdentity => {
    const identity = context
      .switchToHttp()
      .getRequest<KnowledgeRequest>().identity;
    if (!identity) throw new ForbiddenException();
    return identity;
  },
);
@Injectable()
export class TrustedIdentityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: IdentityVerifier,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.get<boolean>('knowledge.public', context.getHandler()))
      return true;
    const request = context.switchToHttp().getRequest<KnowledgeRequest>();
    const operation = this.reflector.get<{
      action: string;
      resourceType: string;
    }>('knowledge.operation', context.getHandler());
    const identity = await this.verifier.verify(request);
    if (
      !identity ||
      !operation ||
      identity.audience !== '@amani/knowledge' ||
      !(Date.parse(identity.expiresAt) > Date.now()) ||
      identity.scope.action !== operation.action ||
      identity.scope.resourceType !== operation.resourceType ||
      !request.correlationId
    )
      throw new ForbiddenException();
    if (
      request.params.organizationId &&
      request.params.organizationId !== identity.organizationId
    )
      throw new ForbiddenException();
    if (
      identity.scope.resourceId !== undefined &&
      (request.params.id ?? request.params.knowledgeBaseId) !==
        identity.scope.resourceId
    )
      throw new ForbiddenException();
    if (!request.requestId) throw new ForbiddenException();
    request.identity = identity;
    request.actor = {
      userId: identity.userId,
      organizationId: identity.organizationId,
      requestId: request.requestId as RequestId,
      correlationId: request.correlationId,
    };
    return true;
  }
}
