import type {
  CorrelationId,
  JsonValue,
  OrganizationId,
  Paginated,
  PluginName,
  RequestId,
  ServiceName,
  UserId,
} from '../src/index.js';

declare const organizationId: OrganizationId;
declare const requestId: RequestId;
declare const userId: UserId;
declare function acceptsUser(id: UserId): void;
declare function acceptsCorrelation(id: CorrelationId): void;
declare function acceptsJson(value: JsonValue): void;
declare function acceptsService(name: ServiceName): void;
declare function acceptsPlugin(name: PluginName): void;

acceptsUser(userId);
// @ts-expect-error An organization ID must not be used as a user ID.
acceptsUser(organizationId);
// @ts-expect-error Raw strings require validation at the owning boundary.
acceptsUser('unverified-user');
// @ts-expect-error Request and correlation IDs have distinct meanings.
acceptsCorrelation(requestId);
acceptsJson({ resource: { ids: ['example'], active: true }, missing: null });
// @ts-expect-error Dates must be serialized before crossing JSON boundaries.
acceptsJson(new Date());
// @ts-expect-error Functions cannot be transport data.
acceptsJson({ callback: () => 'value' });
acceptsService('@amani/knowledge');
// @ts-expect-error Frontends are not authenticated backend service identities.
acceptsService('@amani/admin');
acceptsPlugin('data-analytics');
// @ts-expect-error A plugin name is not its scoped npm package name.
acceptsPlugin('@amani/knowledge');

declare const page: Paginated<{ readonly id: UserId }>;
// @ts-expect-error Transport collections are readonly.
page.items.push({ id: userId });
