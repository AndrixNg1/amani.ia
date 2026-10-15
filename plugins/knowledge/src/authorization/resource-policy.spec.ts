import { NotFoundException } from '@nestjs/common';
import { ResourcePolicy } from './resource-policy';

const actor = {
  userId: '00000000-0000-4000-8000-000000000001',
  organizationId: '00000000-0000-4000-8000-000000000010',
  requestId: '00000000-0000-4000-8000-000000000011',
  correlationId: '00000000-0000-4000-8000-000000000012',
} as any;
function policyWith(rows: Array<unknown[]>) {
  const execute = jest.fn();
  for (const value of rows) execute.mockResolvedValueOnce({ rows: value });
  const database = { db: { execute } } as any;
  const core = {
    authorize: jest
      .fn()
      .mockResolvedValue({
        membershipId: '00000000-0000-4000-8000-000000000013',
        decision: { allowed: true },
      }),
  } as any;
  return { policy: new ResourcePolicy(database, core), execute, core };
}
describe('Knowledge resource policy', () => {
  it('denies a same-tenant member by default when there is no matching base grant', async () => {
    const { policy } = policyWith([[{ id: 'base' }], [{ exists: false }]]);
    await expect(
      policy.assert(
        actor,
        actor.organizationId,
        'knowledge_base',
        'base',
        'read',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
  it('does not permit a guessed base UUID from another organization', async () => {
    const { policy, execute } = policyWith([[]]);
    await expect(
      policy.assert(
        actor,
        actor.organizationId,
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
      policy.assert(
        actor,
        actor.organizationId,
        'document',
        'document',
        'read',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
