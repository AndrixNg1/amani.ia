import { NotFoundException } from '@nestjs/common';
import type { Actor } from '../common/context';
import type { DatabaseService } from '../database/database';
import type { CorePolicyClient } from './core-client';
import { ResourcePolicy } from './resource-policy';

const actor = {
  userId: '00000000-0000-4000-8000-000000000001',
  requestId: 'request-000000000001',
  correlationId: 'correlation-000000000001',
} as Actor;

describe('ResourcePolicy', () => {
  it('denies a dataset when Core allows the operation but no local grant exists', async () => {
    const execute = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ dataset_id: '00000000-0000-4000-8000-000000000010' }] })
      .mockResolvedValueOnce({ rows: [{ exists: false }] });
    const database = { db: { execute } } as unknown as DatabaseService;
    const core = {
      authorize: jest.fn().mockResolvedValue({
        decision: 'allow',
        membershipId: '00000000-0000-4000-8000-000000000011',
      }),
    } as unknown as CorePolicyClient;
    const policy = new ResourcePolicy(database, core);

    await expect(
      policy.assert(
        actor,
        '00000000-0000-4000-8000-000000000100',
        'dataset',
        '00000000-0000-4000-8000-000000000010',
        'read',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
