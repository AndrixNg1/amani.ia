import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/context';
import type { HealthResponse } from '@amani/contracts';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @Public()
  getHealth(): HealthResponse {
    return { status: 'ok', service: '@amani/core-api' };
  }
}
