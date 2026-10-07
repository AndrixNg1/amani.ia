import { createParamDecorator, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { ApiMetadata, AuthenticatedPrincipal } from '@amani/contracts';
import type { OrganizationId } from '@amani/types';
import type { Request } from 'express';

export interface RequestContext extends ApiMetadata {
  service: '@amani/gateway';
  principal?: AuthenticatedPrincipal;
  organizationId?: OrganizationId;
}
export interface GatewayRequest extends Request {
  context: RequestContext;
}
export const CurrentContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestContext =>
    ctx.switchToHttp().getRequest<GatewayRequest>().context,
);
export function principalOf(context: RequestContext): AuthenticatedPrincipal {
  if (!context.principal) throw new UnauthorizedException();
  return context.principal;
}
