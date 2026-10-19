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
  audience: '@amani/data-analytics';
  scope: AuthorizationScope;
  expiresAt: string;
}
export type AnalyticsRequest = Request & {
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
export const Public = () => SetMetadata('analytics.public', true);
export const Operation = (action: string, resourceType: string) =>
  SetMetadata('analytics.operation', { action, resourceType });
export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Actor => {
    const actor = context.switchToHttp().getRequest<AnalyticsRequest>().actor;
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
    if (this.reflector.get<boolean>('analytics.public', context.getHandler()))
      return true;
    const request = context.switchToHttp().getRequest<AnalyticsRequest>();
    const operation = this.reflector.get<{
      action: string;
      resourceType: string;
    }>('analytics.operation', context.getHandler());
    const identity = await this.verifier.verify(request);
    if (
      !identity ||
      !operation ||
      identity.audience !== '@amani/data-analytics' ||
      !(Date.parse(identity.expiresAt) > Date.now()) ||
      identity.scope.action !== operation.action ||
      identity.scope.resourceType !== operation.resourceType ||
      !request.correlationId ||
      !request.requestId
    )
      throw new ForbiddenException();
    const organizationId =
      request.params.organizationId ??
      request.query.organizationId ??
      (request.body as { organizationId?: unknown } | undefined)
        ?.organizationId;
    if (
      organizationId !== undefined &&
      organizationId !== identity.organizationId
    )
      throw new ForbiddenException();
    const resourceId =
      request.params.id ??
      request.params.datasetId ??
      request.params.sourceId ??
      request.params.versionId ??
      request.params.analysisRequestId;
    if (
      identity.scope.resourceId !== undefined &&
      resourceId !== identity.scope.resourceId
    )
      throw new ForbiddenException();
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
