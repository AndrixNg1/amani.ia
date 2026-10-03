import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentActor, Operation } from '../common/context';
import type { Actor } from '../common/context';
import {
  InstallationRequestDto,
  InstallationStatusDto,
  PluginKeyParam,
} from '../common/dto';
import { PluginsService } from './plugins.service';
@Controller()
export class PluginsController {
  constructor(private readonly plugins: PluginsService) {}
  @Get('plugins/:pluginKey')
  @Operation('plugins.read', 'plugin')
  catalog(@CurrentActor() actor: Actor, @Param() param: PluginKeyParam) {
    return this.plugins.catalog(actor, param.pluginKey);
  }
  @Post('organizations/:organizationId/plugins')
  @Operation('plugins.manage', 'plugin_installation')
  request(
    @CurrentActor() actor: Actor,
    @Param('organizationId', ParseUUIDPipe) org: string,
    @Body() body: InstallationRequestDto,
  ) {
    return this.plugins.request(actor, org, body.pluginKey, body.versionId);
  }
  @Get('organizations/:organizationId/plugins/:id')
  @Operation('organization.read', 'plugin_installation')
  get(
    @CurrentActor() actor: Actor,
    @Param('organizationId', ParseUUIDPipe) org: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.plugins.get(actor, org, id);
  }
  @Patch('organizations/:organizationId/plugins/:id')
  @Operation('plugins.manage', 'plugin_installation')
  status(
    @CurrentActor() actor: Actor,
    @Param('organizationId', ParseUUIDPipe) org: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: InstallationStatusDto,
  ) {
    return this.plugins.transition(actor, org, id, body.status);
  }
}
