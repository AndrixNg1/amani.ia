export const installationStates = [
  'requested',
  'provisioning',
  'active',
  'suspended',
  'disabled',
  'deprovisioning',
  'failed',
] as const;
export type InstallationState = (typeof installationStates)[number];
const transitions: Record<InstallationState, readonly InstallationState[]> = {
  requested: ['provisioning', 'disabled'],
  provisioning: ['active', 'failed', 'disabled'],
  active: ['suspended', 'disabled', 'deprovisioning'],
  suspended: ['provisioning', 'disabled', 'deprovisioning'],
  disabled: ['requested', 'deprovisioning'],
  deprovisioning: ['disabled', 'failed'],
  failed: ['requested', 'deprovisioning', 'disabled'],
};
export function canTransition(
  from: InstallationState,
  to: InstallationState,
): boolean {
  return from === to || transitions[from]?.includes(to) === true;
}
