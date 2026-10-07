import { BadGatewayException } from '@nestjs/common';
import { isISO8601, isUUID } from 'class-validator';
import type {
  CoreAuthorizationDecision,
  CoreEffectivePermissions,
  CoreMembership,
  CoreOrganization,
  CoreUser,
} from '@amani/contracts';

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadGatewayException();
  return value as Record<string, unknown>;
}
function string(row: Record<string, unknown>, key: string, max = 256): string {
  const value = row[key];
  if (typeof value !== 'string' || !value.length || value.length > max)
    throw new BadGatewayException();
  return value;
}
function id(
  row: Record<string, unknown>,
  key: string,
  expected?: string,
): string {
  const value = string(row, key);
  if (!isUUID(value) || (expected !== undefined && expected !== value))
    throw new BadGatewayException();
  return value;
}
function dates(row: Record<string, unknown>) {
  const createdAt = string(row, 'createdAt');
  const updatedAt = string(row, 'updatedAt');
  if (
    !isISO8601(createdAt, { strict: true }) ||
    !isISO8601(updatedAt, { strict: true })
  )
    throw new BadGatewayException();
  return { createdAt, updatedAt };
}
function state<T extends string>(
  row: Record<string, unknown>,
  values: readonly T[],
): T {
  const value = string(row, 'status', 40);
  if (!values.some((item) => item === value)) throw new BadGatewayException();
  return value as T;
}
export function organization(
  value: unknown,
  expected?: string,
): CoreOrganization {
  const row = object(value);
  return {
    id: id(row, 'id', expected),
    name: string(row, 'name', 120),
    slug: string(row, 'slug', 80),
    status: state(row, [
      'draft',
      'provisioning',
      'active',
      'failed',
      'suspended',
    ] as const),
    ...dates(row),
  };
}
export function user(value: unknown, expected: string): CoreUser {
  const row = object(value);
  return {
    id: id(row, 'id', expected),
    email: string(row, 'email', 254),
    displayName: string(row, 'displayName', 120),
    status: state(row, ['active', 'suspended'] as const),
    ...dates(row),
  };
}
export function membership(
  value: unknown,
  org: string,
  userId: string,
): CoreMembership {
  const row = object(value);
  const joinedAt = string(row, 'joinedAt');
  if (!isISO8601(joinedAt, { strict: true })) throw new BadGatewayException();
  return {
    id: id(row, 'id'),
    organizationId: id(row, 'organizationId', org),
    userId: id(row, 'userId', userId),
    status: state(row, ['active', 'inactive'] as const),
    joinedAt,
    ...dates(row),
  };
}
export function decision(
  value: unknown,
  org: string,
  userId: string,
  permission: string,
): CoreAuthorizationDecision {
  const row = object(value);
  id(row, 'organizationId', org);
  id(row, 'userId', userId);
  const reason = row.reason;
  if (
    row.permission !== permission ||
    typeof row.allowed !== 'boolean' ||
    ![
      'ROLE_PERMISSION',
      'INACTIVE_CONTEXT',
      'MISSING_PERMISSION',
      'PLUGIN_UNAVAILABLE',
      'WRONG_ORGANIZATION',
    ].includes(String(reason)) ||
    row.allowed !== (reason === 'ROLE_PERMISSION')
  )
    throw new BadGatewayException();
  return {
    allowed: row.allowed,
    organizationId: org,
    userId,
    permission,
    reason: reason as CoreAuthorizationDecision['reason'],
  };
}
export function effective(
  value: unknown,
  org: string,
  userId: string,
): CoreEffectivePermissions {
  const row = object(value);
  id(row, 'organizationId', org);
  id(row, 'userId', userId);
  if (
    !Array.isArray(row.permissions) ||
    row.permissions.length > 1000 ||
    !row.permissions.every(
      (p: unknown) =>
        typeof p === 'string' && /^[a-z][a-z0-9_.-]{0,119}$/.test(p),
    )
  )
    throw new BadGatewayException();
  return {
    organizationId: org,
    userId,
    permissions: row.permissions as string[],
  };
}
