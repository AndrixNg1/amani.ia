import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentActor, Operation } from '../common/context';
import type { Actor } from '../common/context';
import { GrantDto, OrganizationQuery } from '../common/dto';
import { AccessService } from './access.service';
@Controller()
export class AccessController {
  constructor(private readonly s: AccessService) {}
  @Get('knowledge-bases/:id/access')
  @Operation('knowledge.access.manage', 'knowledge_base')
  listBase(
    @CurrentActor() a: Actor,
    @Query() q: OrganizationQuery,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.s.list(a, q.organizationId, 'knowledge_base', id);
  }
  @Post('knowledge-bases/:id/access')
  @Operation('knowledge.access.manage', 'knowledge_base')
  grantBase(
    @CurrentActor() a: Actor,
    @Query() q: OrganizationQuery,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: GrantDto,
  ) {
    return this.s.grant(a, q.organizationId, 'knowledge_base', id, b);
  }
  @Delete('knowledge-bases/:id/access/:grantId')
  @Operation('knowledge.access.manage', 'knowledge_base')
  revokeBase(
    @CurrentActor() a: Actor,
    @Query() q: OrganizationQuery,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('grantId', ParseUUIDPipe) g: string,
  ) {
    return this.s.revoke(a, q.organizationId, 'knowledge_base', id, g);
  }
  @Get('documents/:id/access')
  @Operation('knowledge.access.manage', 'document')
  listDoc(
    @CurrentActor() a: Actor,
    @Query() q: OrganizationQuery,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.s.list(a, q.organizationId, 'document', id);
  }
  @Post('documents/:id/access')
  @Operation('knowledge.access.manage', 'document')
  grantDoc(
    @CurrentActor() a: Actor,
    @Query() q: OrganizationQuery,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: GrantDto,
  ) {
    return this.s.grant(a, q.organizationId, 'document', id, b);
  }
  @Delete('documents/:id/access/:grantId')
  @Operation('knowledge.access.manage', 'document')
  revokeDoc(
    @CurrentActor() a: Actor,
    @Query() q: OrganizationQuery,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('grantId', ParseUUIDPipe) g: string,
  ) {
    return this.s.revoke(a, q.organizationId, 'document', id, g);
  }
}
