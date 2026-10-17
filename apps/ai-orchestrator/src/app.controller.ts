import { Controller, Get } from '@nestjs/common';
import { Public } from './common/context';
import { AppService } from './app.service';

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
  getHealth(): { status: 'ok'; service: string } {
    return { status: 'ok', service: '@amani/ai-orchestrator' };
  }
}
