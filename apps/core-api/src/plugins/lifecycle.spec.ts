import { canTransition } from './lifecycle';
describe('plugin lifecycle', () => {
  it('requires provisioning before activation', () => {
    expect(canTransition('requested', 'active')).toBe(false);
    expect(canTransition('requested', 'provisioning')).toBe(true);
    expect(canTransition('provisioning', 'active')).toBe(true);
  });
  it('supports idempotency, explicit retry and deprovisioning without deletion', () => {
    expect(canTransition('disabled', 'disabled')).toBe(true);
    expect(canTransition('disabled', 'active')).toBe(false);
    expect(canTransition('failed', 'requested')).toBe(true);
    expect(canTransition('active', 'deprovisioning')).toBe(true);
    expect(canTransition('deprovisioning', 'active')).toBe(false);
  });
});
