import type { KnowledgeAuthorizationResponse } from '@amani/contracts';
import type {
  CorrelationId,
  OrganizationId,
  RequestId,
  UserId,
} from '@amani/types';
import { NotFoundException } from '@nestjs/common';
import type { Actor } from '../common/context';
import type { DatabaseService } from '../database/database';
import type { CorePolicyClient } from './core-client';
import { ResourcePolicy } from './resource-policy';

const organizationId = '00000000-0000-4000-8000-000000000010' as OrganizationId;
const actor: Actor = {
  userId: '00000000-0000-4000-8000-000000000001' as UserId,
  organizationId,
  requestId: '00000000-0000-4000-8000-000000000011' as RequestId,
  correlationId: '00000000-0000-4000-8000-000000000012' as CorrelationId,
};
type QueryResult = { rows: unknown[] };
const authorization: KnowledgeAuthorizationResponse = {
  membershipId: '00000000-0000-4000-8000-000000000013',
  decision: {
    allowed: true,
    organizationId,
    userId: actor.userId,
    permission: 'knowledge.documents.read',
    reason: 'ROLE_PERMISSION',
  },
};
function policyWith(rows: readonly unknown[][]) {
  const execute = jest.fn(async (): Promise<QueryResult> => ({ rows: [] }));
  for (const value of rows) execute.mockResolvedValueOnce({ rows: value });
  const database = { db: { execute } } as unknown as DatabaseService;
  const core = {
    authorize: jest.fn(
      async (): Promise<KnowledgeAuthorizationResponse> => authorization,
    ),
  } as unknown as CorePolicyClient;
  return { policy: new ResourcePolicy(database, core), execute };
}
describe('Knowledge resource policy', () => {
  it('denies a same-tenant member by default when there is no matching base grant', async () => {
    const { policy } = policyWith([[{ id: 'base' }], [{ exists: false }]]);
    await expect(
      policy.assert(actor, organizationId, 'knowledge_base', 'base', 'read'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
  it('does not permit a guessed base UUID from another organization', async () => {
    const { policy, execute } = policyWith([[]]);
    await expect(
      policy.assert(
        actor,
        organizationId,
        'knowledge_base',
        '00000000-0000-4000-8000-000000000099',
        'read',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it('requires the document grant as well as base access for a restricted document', async () => {
    const { policy } = policyWith([
      [{ knowledge_base_id: 'base' }],
      [{ exists: true }],
      [{ access_mode: 'restricted' }],
      [{ exists: false }],
    ]);
    await expect(
      policy.assert(actor, organizationId, 'document', 'document', 'read'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
