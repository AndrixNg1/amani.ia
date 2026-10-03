import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../common/context';
import { DatabaseService } from '../database/database';
@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}
  @Get('ready')
  @Public()
  async ready() {
    try {
      await this.database.ready();
    } catch {
      throw new ServiceUnavailableException();
    }
    return { status: 'ok', service: '@amani/core-api', database: 'ready' };
  }
}
