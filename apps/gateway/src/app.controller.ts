import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/guards';
import { AuthenticationProvider } from './auth/authentication';
import { CoreClient } from './core-client/core-client';
import { ServiceAuthentication } from './core-client/service-authentication';
import type { HealthResponse } from '@amani/contracts';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly core: CoreClient,
    private readonly auth: AuthenticationProvider,
    private readonly serviceAuth: ServiceAuthentication,
  ) {}

  @Get()
  @Public()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @Public()
  getHealth(): HealthResponse {
    return { status: 'ok', service: '@amani/gateway' };
  }

  @Get('ready')
  @Public()
  async ready() {
    if (!this.auth.configured || !this.serviceAuth.configured)
      throw new ServiceUnavailableException();
    try {
      await this.core.readiness();
    } catch {
      throw new ServiceUnavailableException();
    }
    return { status: 'ok', service: '@amani/gateway', core: 'ready' };
  }
}
