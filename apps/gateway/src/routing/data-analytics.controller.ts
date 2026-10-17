import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import type { AuthorizationScope } from '@amani/contracts';
import type { ResourceId } from '@amani/types';
import { RequirePluginUse } from '../auth/guards';
import { CurrentContext } from '../common/context';
import type { RequestContext } from '../common/context';
import { DataAnalyticsClient } from '../data-analytics-client/data-analytics.client';

type Method = 'GET' | 'POST' | 'PATCH';

@Controller('api/analytics/organizations/:organizationId')
@RequirePluginUse('data-analytics')
export class DataAnalyticsController {
  constructor(private readonly client: DataAnalyticsClient) {}

  private forward(
    context: RequestContext,
    operation: string,
    method: Method,
    path: string,
    organizationId: string,
    scope: AuthorizationScope,
    body?: object,
  ) {
    return this.client.request(
      context,
      operation,
      method,
      `${path}?organizationId=${organizationId}`,
      scope,
      body,
    );
  }

  private resourceId(id: string): ResourceId {
    return id as ResourceId;
  }

  @Post('sources/connector')
  createConnector(
    @CurrentContext() context: RequestContext,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() body: object,
  ) {
    return this.forward(
      context,
      'analytics.sources.create',
      'POST',
      '/data-sources/connector',
      organizationId,
      { action: 'analytics.sources.manage', resourceType: 'data_source' },
      body,
    );
  }

  @Get('sources')
  listSources(
    @CurrentContext() context: RequestContext,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    return this.forward(
      context,
      'analytics.sources.list',
      'GET',
      '/data-sources',
      organizationId,
      { action: 'analytics.sources.manage', resourceType: 'data_source' },
    );
  }

  @Post('sources/:id/archive')
  archiveSource(
    @CurrentContext() context: RequestContext,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.forward(
      context,
      'analytics.sources.archive',
      'POST',
      `/data-sources/${id}/archive`,
      organizationId,
      {
        action: 'analytics.sources.manage',
        resourceType: 'data_source',
        resourceId: this.resourceId(id),
      },
    );
  }

  @Post('datasets')
  createDataset(
    @CurrentContext() context: RequestContext,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() body: object,
  ) {
    return this.forward(
      context,
      'analytics.datasets.create',
      'POST',
      '/datasets',
      organizationId,
      { action: 'analytics.datasets.manage', resourceType: 'dataset' },
      body,
    );
  }

  @Get('datasets')
  listDatasets(
    @CurrentContext() context: RequestContext,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    return this.forward(
      context,
      'analytics.datasets.list',
      'GET',
      '/datasets',
      organizationId,
      { action: 'analytics.datasets.read', resourceType: 'dataset' },
    );
  }

  @Get('datasets/:id')
  getDataset(
    @CurrentContext() context: RequestContext,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.dataset(
      context,
      'analytics.datasets.read',
      'GET',
      `/datasets/${id}`,
      organizationId,
      id,
    );
  }

  @Patch('datasets/:id')
  updateDataset(
    @CurrentContext() context: RequestContext,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: object,
  ) {
    return this.dataset(
      context,
      'analytics.datasets.update',
      'PATCH',
      `/datasets/${id}`,
      organizationId,
      id,
      body,
    );
  }

  @Post('datasets/:id/archive')
  archiveDataset(
    @CurrentContext() context: RequestContext,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.dataset(
      context,
      'analytics.datasets.archive',
      'POST',
      `/datasets/${id}/archive`,
      organizationId,
      id,
    );
  }

  @Get('datasets/:id/versions')
  versions(
    @CurrentContext() context: RequestContext,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.dataset(
      context,
      'analytics.versions.list',
      'GET',
      `/datasets/${id}/versions`,
      organizationId,
      id,
    );
  }

  @Get('datasets/:datasetId/tables')
  tables(
    @CurrentContext() context: RequestContext,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('datasetId', ParseUUIDPipe) datasetId: string,
  ) {
    return this.dataset(
      context,
      'analytics.schema.tables',
      'GET',
      `/datasets/${datasetId}/tables`,
      organizationId,
      datasetId,
    );
  }

  @Post('uploads')
  initiateUpload(
    @CurrentContext() context: RequestContext,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() body: object,
  ) {
    return this.forward(
      context,
      'analytics.uploads.initiate',
      'POST',
      '/structured-uploads',
      organizationId,
      { action: 'analytics.uploads.manage', resourceType: 'dataset' },
      body,
    );
  }

  @Post('uploads/:versionId/finalize')
  finalizeUpload(
    @CurrentContext() context: RequestContext,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    return this.forward(
      context,
      'analytics.uploads.finalize',
      'POST',
      `/structured-uploads/${versionId}/finalize`,
      organizationId,
      {
        action: 'analytics.uploads.manage',
        resourceType: 'dataset_version',
        resourceId: this.resourceId(versionId),
      },
    );
  }

  @Post('analysis-requests')
  createAnalysis(
    @CurrentContext() context: RequestContext,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() body: object,
  ) {
    return this.forward(
      context,
      'analytics.analysis.create',
      'POST',
      '/analysis-requests',
      organizationId,
      { action: 'analytics.analysis.create', resourceType: 'dataset' },
      body,
    );
  }

  @Get('analysis-requests/:id')
  getAnalysis(
    @CurrentContext() context: RequestContext,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.forward(
      context,
      'analytics.analysis.read',
      'GET',
      `/analysis-requests/${id}`,
      organizationId,
      {
        action: 'analytics.analysis.read',
        resourceType: 'analysis_request',
        resourceId: this.resourceId(id),
      },
    );
  }

  @Get('analysis-requests/:id/results')
  results(
    @CurrentContext() context: RequestContext,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.forward(
      context,
      'analytics.analysis.results',
      'GET',
      `/analysis-requests/${id}/results`,
      organizationId,
      {
        action: 'analytics.analysis.read',
        resourceType: 'analysis_request',
        resourceId: this.resourceId(id),
      },
    );
  }

  private dataset(
    context: RequestContext,
    operation: string,
    method: Method,
    path: string,
    organizationId: string,
    datasetId: string,
    body?: object,
  ) {
    const action = operation.includes('.read') || operation.includes('.list')
      ? 'analytics.datasets.read'
      : 'analytics.datasets.manage';
    return this.forward(context, operation, method, path, organizationId, {
      action,
      resourceType: 'dataset',
      resourceId: this.resourceId(datasetId),
    }, body);
  }
}
