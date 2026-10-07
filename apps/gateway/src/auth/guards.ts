import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isUUID } from 'class-validator';
import type { Response } from 'express';
import type { OrganizationId } from '@amani/types';
import type { GatewayRequest } from '../common/context';
import { principalOf } from '../common/context';
import { RateLimiter, rateError } from '../common/rate-limit';
import { CoreClient } from '../core-client/core-client';
import { AuthenticationProvider } from './authentication';

export const Public = () => SetMetadata('gateway.public', true);
export const AuthenticatedOnly = () =>
  SetMetadata('gateway.authenticatedOnly', true);
export const RequirePermission = (permission: string) =>
  SetMetadata('gateway.permission', permission);
@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly provider: AuthenticationProvider,
    private readonly limiter: RateLimiter,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.get<boolean>('gateway.public', context.getHandler()))
      return true;
    const request = context.switchToHttp().getRequest<GatewayRequest>();
    const principal = await this.provider.authenticate(
      request.headers.authorization,
    );
    if (!principal) throw new UnauthorizedException();
    request.context.principal = principal;
    const retry = this.limiter.consume('user', principal.userId);
    if (retry) {
      context
        .switchToHttp()
        .getResponse<Response>()
        .setHeader('retry-after', retry);
      throw rateError();
    }
    // Guards precede DTO pipes. Reject invalid routing inputs before contacting Core.
    for (const key of ['organizationId', 'userId']) {
      const value = request.params[key];
      if (value !== undefined && (typeof value !== 'string' || !isUUID(value)))
        throw new BadRequestException();
      if (typeof value === 'string') request.params[key] = value.toLowerCase();
    }
    const plugin = request.params.pluginKey;
    if (
      plugin !== undefined &&
      (typeof plugin !== 'string' ||
        ![
          'knowledge',
          'data-analytics',
          'conversations',
          'connectors',
          'evaluation',
        ].includes(plugin))
    )
      throw new BadRequestException();
    if (request.params.organizationId)
      request.context.organizationId = request.params
        .organizationId as OrganizationId;
    return true;
  }
}
@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly core: CoreClient,
    private readonly limiter: RateLimiter,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.get<boolean>('gateway.public', context.getHandler()))
      return true;
    const req = context.switchToHttp().getRequest<GatewayRequest>();
    principalOf(req.context);
    const permission = this.reflector.get<string>(
      'gateway.permission',
      context.getHandler(),
    );
    if (!permission) {
      // Unscoped routes rely on Core's own self/onboarding policy. An organization
      // route without explicit metadata is always denied, including future routes.
      if (
        req.context.organizationId ||
        !this.reflector.get<boolean>(
          'gateway.authenticatedOnly',
          context.getHandler(),
        )
      )
        throw new ForbiddenException();
      return true;
    }
    if (
      !req.context.organizationId ||
      !(await this.core.check(req.context, permission)).allowed
    )
      throw new ForbiddenException();
    // Unauthorised outsiders cannot spend an organization's shared quota.
    const retry = this.limiter.consume(
      'organization',
      req.context.organizationId,
    );
    if (retry) {
      context
        .switchToHttp()
        .getResponse<Response>()
        .setHeader('retry-after', retry);
      throw rateError();
    }
    return true;
  }
}
