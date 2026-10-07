import {
  BadGatewayException,
  ForbiddenException,
  GatewayTimeoutException,
  HttpException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { AuthorizationScope } from '@amani/contracts';
import type { PluginName, ResourceId } from '@amani/types';
import { GATEWAY_CONFIG } from '../config/gateway.config';
import type { GatewayConfig } from '../config/gateway.config';
import { principalOf } from '../common/context';
import type { RequestContext } from '../common/context';
import { SafeLogger } from '../common/logging';
import { ServiceAuthentication } from './service-authentication';
import * as response from './responses';

@Injectable()
export class CoreClient {
  constructor(
    @Inject(GATEWAY_CONFIG) private readonly config: GatewayConfig,
    private readonly auth: ServiceAuthentication,
    private readonly logger: SafeLogger,
  ) {}
  async readiness() {
    const value = response.object(
      await this.send('ready', 'GET', '/health/ready'),
    );
    if (
      value.status !== 'ok' ||
      value.service !== '@amani/core-api' ||
      value.database !== 'ready'
    )
      throw new BadGatewayException();
  }
  async me(ctx: RequestContext) {
    const userId = principalOf(ctx).userId;
    return response.user(
      await this.send('user.read', 'GET', `/users/${userId}`, ctx, {
        action: 'users.read',
        resourceType: 'user',
        resourceId: userId as unknown as ResourceId,
      }),
      userId,
    );
  }
  async createOrganization(
    ctx: RequestContext,
    body: { name: string; slug: string },
  ) {
    return response.organization(
      await this.send(
        'organization.create',
        'POST',
        '/organizations',
        ctx,
        { action: 'organization.create', resourceType: 'organization' },
        body,
      ),
    );
  }
  async organization(ctx: RequestContext) {
    const org = this.org(ctx);
    return response.organization(
      await this.send(
        'organization.read',
        'GET',
        `/organizations/${org}`,
        ctx,
        {
          action: 'organization.read',
          resourceType: 'organization',
          resourceId: org as ResourceId,
        },
      ),
      org,
    );
  }
  async createMembership(ctx: RequestContext, userId: string) {
    const org = this.org(ctx);
    return response.membership(
      await this.send(
        'membership.create',
        'POST',
        `/organizations/${org}/memberships`,
        ctx,
        { action: 'members.manage', resourceType: 'membership' },
        { userId },
      ),
      org,
      userId,
    );
  }
  async membership(ctx: RequestContext, userId: string) {
    const org = this.org(ctx);
    return response.membership(
      await this.send(
        'membership.read',
        'GET',
        `/organizations/${org}/memberships/by-user/${userId}`,
        ctx,
        {
          action: 'members.read',
          resourceType: 'membership',
          resourceId: userId as ResourceId,
        },
      ),
      org,
      userId,
    );
  }
  async check(ctx: RequestContext, permission: string) {
    const org = this.org(ctx);
    return response.decision(
      await this.send(
        'authorization.check',
        'POST',
        '/internal/authorization/check',
        ctx,
        { action: 'authorization.check', resourceType: 'policy' },
        { organizationId: org, permission },
      ),
      org,
      principalOf(ctx).userId,
      permission,
    );
  }
  async permissions(ctx: RequestContext) {
    const org = this.org(ctx);
    return response.effective(
      await this.send(
        'authorization.effective',
        'GET',
        `/internal/authorization/effective-permissions?organizationId=${org}`,
        ctx,
        { action: 'authorization.read', resourceType: 'policy' },
      ),
      org,
      principalOf(ctx).userId,
    );
  }
  async pluginAccess(ctx: RequestContext, plugin: PluginName) {
    const org = this.org(ctx);
    const decision = response.decision(
      await this.send(
        'plugin.access',
        'GET',
        `/internal/plugins/${plugin}/access?organizationId=${org}`,
        ctx,
        { action: 'authorization.read', resourceType: 'policy', plugin },
      ),
      org,
      principalOf(ctx).userId,
      'plugins.use',
    );
    if (!decision.allowed) throw new ForbiddenException();
    return decision;
  }
  private org(ctx: RequestContext): string {
    if (!ctx.organizationId) throw new ForbiddenException();
    return ctx.organizationId;
  }
  private async send(
    operation: string,
    method: 'GET' | 'POST',
    path: string,
    ctx?: RequestContext,
    scope?: AuthorizationScope,
    data?: object,
  ): Promise<unknown> {
    const started = Date.now();
    let status = 503;
    const signal = AbortSignal.timeout(this.config.coreTimeoutMs);
    try {
      const body = data === undefined ? '' : JSON.stringify(data);
      // Never spread incoming headers. These are the only application headers sent.
      const headers: Record<string, string> = { accept: 'application/json' };
      if (body) headers['content-type'] = 'application/json';
      if (ctx && scope) {
        headers['x-request-id'] = ctx.requestId;
        headers['x-correlation-id'] = ctx.correlationId;
        Object.assign(
          headers,
          this.auth.headers(ctx, { method, path, body, scope }),
        );
      }
      const res = await fetch(this.config.coreBaseUrl + path, {
        method,
        headers,
        ...(body ? { body } : {}),
        signal,
        redirect: 'manual',
      });
      if (
        !(method === 'GET'
          ? res.status === 200
          : [200, 201].includes(res.status))
      ) {
        await res.body?.cancel();
        // Do not expose backend error text, URLs, cookies or authentication challenges.
        status = [400, 403, 404, 409, 429, 503, 504].includes(res.status)
          ? res.status
          : 502;
        throw new HttpException('Core request failed', status);
      }
      if (
        !/^application\/json(?:;|$)/i.test(
          res.headers.get('content-type') ?? '',
        ) ||
        !res.body
      ) {
        await res.body?.cancel();
        throw new BadGatewayException();
      }
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      try {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > this.config.coreMaxResponseBytes) {
            await reader.cancel();
            throw new BadGatewayException();
          }
          chunks.push(chunk.value);
        }
      } finally {
        reader.releaseLock();
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        throw new BadGatewayException();
      }
      status = res.status;
      return parsed;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        status = error.getStatus();
        throw error;
      }
      if (signal.aborted) {
        status = 504;
        throw new GatewayTimeoutException();
      }
      status = 503;
      throw new ServiceUnavailableException();
    } finally {
      this.logger.core(ctx, operation, status, Date.now() - started);
    }
  }
}
