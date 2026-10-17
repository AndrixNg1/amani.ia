import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from './common/context';
import { DatabaseService } from './database/database';
import { ObjectStorage } from './storage/object-storage';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly database: DatabaseService,
    private readonly storage: ObjectStorage,
  ) {}

  @Get()
  @Public()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @Public()
  getHealth(): { status: 'ok'; service: string } {
    return { status: 'ok', service: '@amani/data-analytics' };
  }

  @Get('health/ready')
  @Public()
  async getReadiness(): Promise<{ status: 'ok'; service: string; database: 'ready'; storage: 'ready' }> {
    try {
      await this.database.ready();
      await this.storage.assertReady();
    } catch {
      throw new ServiceUnavailableException();
    }
    return {
      status: 'ok',
      service: '@amani/data-analytics',
      database: 'ready',
      storage: 'ready',
    };
  }
}
