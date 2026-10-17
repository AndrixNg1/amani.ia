import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentActor, Operation } from '../common/context';
import type { Actor } from '../common/context';
import { CreateAnalysisRequestDto, OrganizationQuery } from '../common/dto';
import { AnalysisService } from './analysis.service';
@Controller('analysis-requests')
export class AnalysisController {
  constructor(private readonly service: AnalysisService) {}
  @Post() @Operation('analytics.analysis.create', 'dataset')
  create(@CurrentActor() actor: Actor, @Query() query: OrganizationQuery, @Body() body: CreateAnalysisRequestDto) { return this.service.create(actor, query.organizationId, body); }
  @Get(':analysisRequestId') @Operation('analytics.analysis.read', 'analysis_request')
  get(@CurrentActor() actor: Actor, @Query() query: OrganizationQuery, @Param('analysisRequestId', ParseUUIDPipe) id: string) { return this.service.get(actor, query.organizationId, id); }
  @Get(':analysisRequestId/results') @Operation('analytics.analysis.read', 'analysis_request')
  results(@CurrentActor() actor: Actor, @Query() query: OrganizationQuery, @Param('analysisRequestId', ParseUUIDPipe) id: string) { return this.service.results(actor, query.organizationId, id); }
}
