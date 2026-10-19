import { createHash } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { isUUID } from 'class-validator';
import type { AnalysisOperation, AnalysisScope } from '@amani/contracts';
import type { Actor } from '../common/context';
import type { CreateAnalysisRequestDto } from '../common/dto';
import { DatabaseService } from '../database/database';
import { ResourcePolicy } from '../authorization/resource-policy';

type SafeParameters = Record<string, string | number | boolean>;
const operationKeys: Record<AnalysisOperation, readonly string[]> = {
  profile: ['tableId'],
  describe: ['tableId', 'columnId'],
  aggregate: ['tableId', 'columnId', 'aggregation'],
  group: ['tableId', 'groupByColumnId', 'measureColumnId', 'aggregation'],
  filter: ['tableId', 'columnId', 'operator', 'value'],
  correlation: ['tableId', 'columnIdA', 'columnIdB'],
  chart_data: ['tableId', 'xColumnId', 'yColumnId', 'aggregation'],
};
function requireUuid(parameters: SafeParameters, name: string): string {
  const value = parameters[name];
  if (typeof value !== 'string' || !isUUID(value))
    throw new UnprocessableEntityException();
  return value;
}
function optionalUuid(
  parameters: SafeParameters,
  name: string,
): string | undefined {
  const value = parameters[name];
  if (value === undefined) return;
  if (typeof value !== 'string' || !isUUID(value))
    throw new UnprocessableEntityException();
  return value;
}
export function validateAnalysisParameters(
  operation: AnalysisOperation,
  input: Record<string, unknown>,
): SafeParameters {
  const allowed = operationKeys[operation];
  const parameters: SafeParameters = {};
  for (const [key, value] of Object.entries(input)) {
    if (
      !allowed.includes(key) ||
      !['string', 'number', 'boolean'].includes(typeof value)
    )
      throw new UnprocessableEntityException();
    parameters[key] = value as string | number | boolean;
  }
  if (operation === 'profile') optionalUuid(parameters, 'tableId');
  if (operation === 'describe') {
    optionalUuid(parameters, 'tableId');
    optionalUuid(parameters, 'columnId');
  }
  if (operation === 'aggregate') {
    requireUuid(parameters, 'tableId');
    requireUuid(parameters, 'columnId');
    if (
      !['count', 'sum', 'avg', 'min', 'max'].includes(
        String(parameters.aggregation),
      )
    )
      throw new UnprocessableEntityException();
  }
  if (operation === 'group') {
    requireUuid(parameters, 'tableId');
    requireUuid(parameters, 'groupByColumnId');
    requireUuid(parameters, 'measureColumnId');
    if (
      !['count', 'sum', 'avg', 'min', 'max'].includes(
        String(parameters.aggregation),
      )
    )
      throw new UnprocessableEntityException();
  }
  if (operation === 'filter') {
    requireUuid(parameters, 'tableId');
    requireUuid(parameters, 'columnId');
    if (
      !['eq', 'neq', 'gt', 'gte', 'lt', 'lte'].includes(
        String(parameters.operator),
      ) ||
      parameters.value === undefined
    )
      throw new UnprocessableEntityException();
  }
  if (operation === 'correlation') {
    requireUuid(parameters, 'tableId');
    requireUuid(parameters, 'columnIdA');
    requireUuid(parameters, 'columnIdB');
    if (parameters.columnIdA === parameters.columnIdB)
      throw new UnprocessableEntityException();
  }
  if (operation === 'chart_data') {
    requireUuid(parameters, 'tableId');
    requireUuid(parameters, 'xColumnId');
    requireUuid(parameters, 'yColumnId');
    if (
      parameters.aggregation !== undefined &&
      !['count', 'sum', 'avg', 'min', 'max'].includes(
        String(parameters.aggregation),
      )
    )
      throw new UnprocessableEntityException();
  }
  return parameters;
}
function scopeAllows(scope: AnalysisScope, parameters: SafeParameters) {
  const tableIds = ['tableId'].flatMap((key) =>
    typeof parameters[key] === 'string' ? [parameters[key]] : [],
  );
  const columnIds = [
    'columnId',
    'groupByColumnId',
    'measureColumnId',
    'columnIdA',
    'columnIdB',
    'xColumnId',
    'yColumnId',
  ].flatMap((key) =>
    typeof parameters[key] === 'string' ? [parameters[key]] : [],
  );
  if (tableIds.some((id) => !scope.allowedTableIds.includes(id)))
    throw new UnprocessableEntityException();
  if (
    columnIds.some(
      (id) =>
        !scope.columns.some(
          (column) => column.columnId === id && column.access === 'allowed',
        ),
    )
  )
    throw new UnprocessableEntityException();
}
@Injectable()
export class AnalysisService {
  constructor(
    private readonly database: DatabaseService,
    private readonly policy: ResourcePolicy,
  ) {}
  async create(
    actor: Actor,
    organizationId: string,
    dto: CreateAnalysisRequestDto,
  ) {
    const membershipId = await this.policy.assert(
      actor,
      organizationId,
      'dataset',
      dto.datasetId,
      'analyze',
    );
    const parameters = validateAnalysisParameters(
      dto.operation,
      dto.parameters,
    );
    const version = await this.database.db.execute<{ id: string }>(sql`
      SELECT v.id FROM data_analytics.dataset_versions v JOIN data_analytics.datasets d
        ON d.organization_id=v.organization_id AND d.id=v.dataset_id AND d.status <> 'archived'
      WHERE v.organization_id=${organizationId} AND v.dataset_id=${dto.datasetId} AND v.id=${dto.datasetVersionId}
        AND v.import_status IN ('pending','ready')`);
    if (!version.rows[0]) throw new NotFoundException();
    const scope = await this.policy.scope(
      organizationId,
      dto.datasetId,
      membershipId,
      dto.operation,
    );
    scopeAllows(scope, parameters);
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          datasetId: dto.datasetId,
          datasetVersionId: dto.datasetVersionId,
          operation: dto.operation,
          parameters,
        }),
      )
      .digest('hex');
    const request = await this.database.transaction(async (tx) => {
      const prior = await tx.execute<{
        request_fingerprint: string;
        analysis_request_id: string;
        status: string;
      }>(sql`
        SELECT i.request_fingerprint,r.id AS analysis_request_id,r.status FROM data_analytics.analysis_request_idempotency i
        JOIN data_analytics.analysis_requests r ON r.organization_id=i.organization_id AND r.id=i.analysis_request_id
        WHERE i.organization_id=${organizationId} AND i.membership_id=${membershipId} AND i.idempotency_key=${dto.idempotencyKey} FOR UPDATE`);
      if (prior.rows[0]) {
        if (prior.rows[0].request_fingerprint !== fingerprint)
          throw new ConflictException();
        return {
          id: prior.rows[0].analysis_request_id,
          status: prior.rows[0].status,
          idempotent: true,
        };
      }
      const inserted = await tx.execute<{ id: string; status: string }>(sql`
        INSERT INTO data_analytics.analysis_requests(organization_id,dataset_id,dataset_version_id,requested_by_membership_id,operation,parameters,scope,status,correlation_id)
        VALUES(${organizationId},${dto.datasetId},${dto.datasetVersionId},${membershipId},${dto.operation},${JSON.stringify(parameters)}::jsonb,${JSON.stringify(scope)}::jsonb,'pending',${actor.correlationId})
        RETURNING id,status`);
      await tx.execute(sql`
        INSERT INTO data_analytics.analysis_request_idempotency(organization_id,membership_id,idempotency_key,request_fingerprint,analysis_request_id)
        VALUES(${organizationId},${membershipId},${dto.idempotencyKey},${fingerprint},${inserted.rows[0].id})`);
      return { ...inserted.rows[0], idempotent: false };
    });
    // The versioned DataAnalysisRequestedV1 contract is defined in @amani/contracts.
    // Phase 10 will select an interoperable transport and create this payload server-side.
    return request;
  }
  async get(actor: Actor, organizationId: string, id: string) {
    const request = await this.database.db.execute<{ dataset_id: string }>(sql`
      SELECT dataset_id FROM data_analytics.analysis_requests WHERE organization_id=${organizationId} AND id=${id}`);
    if (!request.rows[0]) throw new NotFoundException();
    await this.policy.assert(
      actor,
      organizationId,
      'dataset',
      request.rows[0].dataset_id,
      'analyze',
    );
    const result = await this.database.db.execute(sql`
      SELECT id,dataset_id AS "datasetId",dataset_version_id AS "datasetVersionId",operation,status,created_at AS "createdAt",updated_at AS "updatedAt"
      FROM data_analytics.analysis_requests WHERE organization_id=${organizationId} AND id=${id}`);
    return result.rows[0];
  }
  async results(actor: Actor, organizationId: string, id: string) {
    const request = await this.database.db.execute<{ dataset_id: string }>(sql`
      SELECT dataset_id FROM data_analytics.analysis_requests WHERE organization_id=${organizationId} AND id=${id}`);
    if (!request.rows[0]) throw new NotFoundException();
    await this.policy.assert(
      actor,
      organizationId,
      'dataset',
      request.rows[0].dataset_id,
      'read',
    );
    return (
      await this.database.db.execute(sql`
      SELECT id,status,result_type AS "resultType",artifact_reference AS "artifactReference",summary_metadata AS "summaryMetadata",expires_at AS "expiresAt",created_at AS "createdAt"
      FROM data_analytics.analysis_results WHERE organization_id=${organizationId} AND analysis_request_id=${id} ORDER BY created_at ASC`)
    ).rows;
  }
}
