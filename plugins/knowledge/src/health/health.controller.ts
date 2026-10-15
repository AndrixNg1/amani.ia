import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/context';
import { ObjectStorage } from '../storage/object-storage';
import { DatabaseService } from '../database/database';
@Controller('health')
export class HealthController {
  constructor(
    private readonly database: DatabaseService,
    private readonly storage: ObjectStorage,
  ) {}
  @Get() @Public() live() {
    return { status: 'ok' as const, service: '@amani/knowledge' as const };
  }
  @Get('ready') @Public() async ready() {
    await this.database.ready();
    await this.storage.assertReady();
    return { status: 'ok' as const, service: '@amani/knowledge' as const };
  }
}
