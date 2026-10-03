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
  ServiceName,
  UserId,
} from '@amani/types';
import type { Request } from 'express';

/** Constructed only by trusted server code, never deserialized from HTTP input. */
export interface Actor {
  userId: UserId;
  organizationId?: OrganizationId;
  correlationId: CorrelationId;
}
export interface VerifiedIdentity {
  userId: UserId;
  organizationId?: OrganizationId;
  callingService: ServiceName;
  audience: '@amani/core-api';
  scope: AuthorizationScope;
  expiresAt: string;
}
export type CoreRequest = Request & {
  actor?: Actor;
  correlationId?: CorrelationId;
};

@Injectable()
export class IdentityVerifier {
  // Extension point for cryptographic service/delegation authentication in a later phase.
  // No environment toggle, header, network location or bearer string enables access.
  verify(_request: Request): Promise<VerifiedIdentity | null> {
    void _request;
    return Promise.resolve(null);
  }
}
export const Public = () => SetMetadata('core.public', true);
export const Operation = (action: string, resourceType: string) =>
  SetMetadata('core.operation', { action, resourceType });
export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Actor => {
    const actor = context.switchToHttp().getRequest<CoreRequest>().actor;
    if (!actor) throw new ForbiddenException();
    return actor;
  },
);
export function assertScope(actor: Actor, organizationId: string) {
  if (actor.organizationId !== organizationId) throw new ForbiddenException();
}

@Injectable()
export class TrustedIdentityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: IdentityVerifier,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.get<boolean>('core.public', context.getHandler()))
      return true;
    const request = context.switchToHttp().getRequest<CoreRequest>();
    const operation = this.reflector.get<{
      action: string;
      resourceType: string;
    }>('core.operation', context.getHandler());
    const identity = await this.verifier.verify(request);
    if (
      !identity ||
      !operation ||
      identity.audience !== '@amani/core-api' ||
      !(Date.parse(identity.expiresAt) > Date.now()) ||
      identity.scope.action !== operation.action ||
      identity.scope.resourceType !== operation.resourceType
    )
      throw new ForbiddenException();
    // Route IDs further restrict the authenticated delegation, never expand it.
    if (
      request.params.organizationId &&
      request.params.organizationId !== identity.organizationId
    )
      throw new ForbiddenException();
    if (
      identity.scope.resourceId !== undefined &&
      (request.params.id ??
        (operation.resourceType === 'organization'
          ? request.params.organizationId
          : undefined)) !== identity.scope.resourceId
    )
      throw new ForbiddenException();
    if (identity.scope.plugin !== undefined) {
      const body: unknown = request.body;
      const plugin =
        request.params.pluginKey ??
        (body && typeof body === 'object' && 'pluginKey' in body
          ? body.pluginKey
          : undefined);
      if (plugin !== identity.scope.plugin) throw new ForbiddenException();
    }
    if (!request.correlationId) throw new ForbiddenException();
    request.actor = {
      userId: identity.userId,
      organizationId: identity.organizationId,
      correlationId: request.correlationId,
    };
    return true;
  }
}
