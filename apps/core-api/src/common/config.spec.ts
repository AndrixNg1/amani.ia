import { coreConfig } from './config';
describe('Core configuration', () => {
  const source = {
    DB_HOST: '127.0.0.1',
    DB_NAME: 'amani',
    CORE_PLATFORM_DB_PASSWORD: 'synthetic-password',
  };
  it('uses fixed service identity even when bootstrap credentials are present', () => {
    const config = coreConfig({
      ...source,
      POSTGRES_USER: 'amani',
      DB_USER: 'postgres',
    });
    expect(config.database.user).toBe('amani_core_platform');
    expect(config.database.options).toContain('search_path=core_platform');
    expect(config.port).toBe(4001);
  });
  it('fails without service credentials and does not disclose values', () => {
    expect(() =>
      coreConfig({ ...source, CORE_PLATFORM_DB_PASSWORD: undefined }),
    ).toThrow('CORE_PLATFORM_DB_PASSWORD');
    expect(() =>
      coreConfig({ ...source, DB_PORT: 'secret-invalid-value' }),
    ).toThrow('DB_PORT');
    try {
      coreConfig({ ...source, DB_PORT: 'secret-invalid-value' });
    } catch (error) {
      expect(String(error)).not.toContain('secret-invalid-value');
    }
  });
  it('requires verified TLS outside development and test', () => {
    expect(() => coreConfig({ ...source, APP_ENV: 'production' })).toThrow(
      'DB_SSL',
    );
    expect(
      coreConfig({ ...source, APP_ENV: 'production', DB_SSL: 'true' }).database
        .ssl,
    ).toEqual({ rejectUnauthorized: true });
  });
});
