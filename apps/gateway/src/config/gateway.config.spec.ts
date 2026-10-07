import { randomBytes, randomUUID } from 'node:crypto';
import { gatewayConfig } from './gateway.config';
import { authenticationProvider } from '../auth/authentication';
import { RateLimiter } from '../common/rate-limit';

const token = randomBytes(32).toString('hex');
const local = {
  NODE_ENV: 'test',
  GATEWAY_AUTH_MODE: 'development',
  GATEWAY_DEV_BEARER_TOKEN: token,
  GATEWAY_DEV_USER_ID: randomUUID(),
};
describe('Gateway configuration and local authentication', () => {
  it('is closed by default', async () => {
    const provider = authenticationProvider(gatewayConfig({}));
    expect(provider.configured).toBe(false);
    expect(await provider.authenticate(`Bearer ${token}`)).toBeNull();
  });
  it('maps an explicit opaque token to exactly the configured identity', async () => {
    const auth = authenticationProvider(gatewayConfig(local));
    expect(await auth.authenticate(`Bearer ${token}`)).toMatchObject({
      userId: local.GATEWAY_DEV_USER_ID,
      authenticationMethod: 'development-token',
    });
    expect(
      await auth.authenticate(`Bearer ${randomBytes(32).toString('hex')}`),
    ).toBeNull();
    expect(await auth.authenticate(undefined)).toBeNull();
  });
  it.each([
    {
      NODE_ENV: 'production',
      CORE_API_BASE_URL: 'https://core.example.invalid',
    },
    { APP_ENV: 'production' },
    { APP_ENV: 'staging' },
    { NODE_ENV: undefined },
    { GATEWAY_HOST: '0.0.0.0' },
    { CORE_API_BASE_URL: 'http://core.example.invalid' },
  ])(
    'refuses development identity outside explicit local development: %j',
    (override) => {
      expect(() => gatewayConfig({ ...local, ...override })).toThrow();
    },
  );
  it.each([
    { CORE_API_BASE_URL: 'http://secret:password@localhost:4001' },
    { CORE_API_BASE_URL: 'http://localhost:4001/internal' },
    { GATEWAY_ALLOWED_ORIGINS: '*' },
    { GATEWAY_ALLOWED_ORIGINS: 'https://app.example.invalid/path' },
    { GATEWAY_AUTH_MODE: 'headers' },
    { GATEWAY_RATE_IP: '0' },
    { CORE_API_TIMEOUT_MS: '0' },
  ])(
    'rejects unsafe edge configuration without leaking values: %j',
    (override) => {
      expect(() => gatewayConfig(override)).toThrow();
      try {
        gatewayConfig(override);
      } catch (error) {
        expect(String(error)).not.toContain('password');
      }
    },
  );
  it('requires distinct bearer and service credentials', () => {
    expect(() =>
      gatewayConfig({
        ...local,
        GATEWAY_SERVICE_AUTH_MODE: 'development',
        DEVELOPMENT_SERVICE_SECRET: token,
      }),
    ).toThrow();
  });
  it('limits all quota dimensions, expires counters, and bounds cardinality', () => {
    const limiter = new RateLimiter(
      gatewayConfig({
        GATEWAY_RATE_IP: '1',
        GATEWAY_RATE_USER: '1',
        GATEWAY_RATE_ORGANIZATION: '1',
        GATEWAY_RATE_MAX_KEYS: '3',
        GATEWAY_RATE_WINDOW_MS: '1000',
      }),
    );
    for (const dimension of ['ip', 'user', 'organization'] as const) {
      expect(limiter.consume(dimension, 'one', 'read', 0)).toBe(0);
      expect(limiter.consume(dimension, 'one', 'read', 1)).toBe(1);
    }
    expect(limiter.consume('ip', 'new', 'read', 1)).toBe(1);
    expect(limiter.consume('ip', 'new', 'read', 1001)).toBe(0);
  });
});
