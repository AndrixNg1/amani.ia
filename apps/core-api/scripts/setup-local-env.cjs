const {
  readFileSync,
  appendFileSync,
  existsSync,
  chmodSync,
} = require('node:fs');
const { resolve } = require('node:path');
const { parseEnv } = require('node:util');
try {
  const source = parseEnv(
    readFileSync(resolve(__dirname, '../../../.env'), 'utf8'),
  );
  const values = {
    APP_ENV: 'development',
    HOST: '127.0.0.1',
    PORT: '4001',
    DB_HOST: source.POSTGRES_HOST || '127.0.0.1',
    DB_PORT: source.POSTGRES_PORT || '5432',
    DB_NAME: source.POSTGRES_DB,
    CORE_PLATFORM_DB_PASSWORD: source.CORE_PLATFORM_DB_PASSWORD,
    DB_SSL: 'false',
    DB_POOL_SIZE: '10',
  };
  const target = resolve(__dirname, '../.env');
  const existing = existsSync(target)
    ? parseEnv(readFileSync(target, 'utf8'))
    : {};
  const lines = Object.entries(values)
    .filter(([key]) => existing[key] === undefined)
    .map(([key, value]) => {
      if (!value || /[\r\n]/.test(value)) throw new Error();
      const quote = value.includes("'") ? '"' : "'";
      if (value.includes(quote)) throw new Error();
      return `${key}=${quote}${value}${quote}`;
    });
  appendFileSync(target, `\n${lines.join('\n')}\n`, { mode: 0o600 });
  chmodSync(target, 0o600);
  console.log(
    'Core .env prepared (mode 600). Existing keys preserved; missing keys copied from Core PostgreSQL configuration.',
  );
} catch {
  console.error(
    'Core .env could not be prepared. Check root .env and merge the example manually.',
  );
  process.exitCode = 1;
}
