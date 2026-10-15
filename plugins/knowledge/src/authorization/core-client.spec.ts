import { isKnowledgeAuthorizationResponse } from './core-client';
describe('Core authorization response boundary', () => {
  it.each([
    null,
    {},
    { membershipId: 'member' },
    { decision: { allowed: true } },
    {
      membershipId: 'member',
      decision: {
        allowed: 'true',
        organizationId: 'org',
        userId: 'user',
        permission: 'plugins.use',
      },
    },
  ])('rejects malformed or incomplete Core responses: %j', (value) =>
    expect(isKnowledgeAuthorizationResponse(value)).toBe(false),
  );
  it('accepts only a structured current authorization decision', () =>
    expect(
      isKnowledgeAuthorizationResponse({
        membershipId: '00000000-0000-4000-8000-000000000001',
        decision: {
          allowed: true,
          organizationId: '00000000-0000-4000-8000-000000000002',
          userId: '00000000-0000-4000-8000-000000000003',
          permission: 'plugins.use',
          reason: 'ROLE_PERMISSION',
        },
      }),
    ).toBe(true));
});
