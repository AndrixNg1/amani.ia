const {
  appendFileSync,
  chmodSync,
  existsSync,
  readFileSync,
} = require('node:fs');
const { resolve } = require('node:path');
const { parseEnv } = require('node:util');
try {
  const root = parseEnv(
    readFileSync(resolve(__dirname, '../../../.env'), 'utf8'),
  );
  const values = {
    APP_ENV: 'development',
    HOST: '127.0.0.1',
    PORT: '4101',
    DB_HOST: root.POSTGRES_HOST || '127.0.0.1',
    DB_PORT: root.POSTGRES_PORT || '5432',
    DB_NAME: root.POSTGRES_DB,
    KNOWLEDGE_DB_PASSWORD: root.KNOWLEDGE_DB_PASSWORD,
    DB_SSL: 'false',
    DB_POOL_SIZE: '10',
    CORE_API_URL: 'http://127.0.0.1:4001',
    CORE_API_TIMEOUT_MS: '3000',
    KNOWLEDGE_STORAGE_ENDPOINT: root.MINIO_ENDPOINT || 'http://127.0.0.1:9000',
    KNOWLEDGE_STORAGE_REGION: 'us-east-1',
    KNOWLEDGE_STORAGE_BUCKET: 'amani-knowledge-originals',
    KNOWLEDGE_STORAGE_ACCESS_KEY: root.MINIO_ROOT_USER,
    KNOWLEDGE_STORAGE_SECRET_KEY: root.MINIO_ROOT_PASSWORD,
    KNOWLEDGE_STORAGE_FORCE_PATH_STYLE: 'true',
    KNOWLEDGE_UPLOAD_URL_SECONDS: '300',
    KNOWLEDGE_DOWNLOAD_URL_SECONDS: '120',
    KNOWLEDGE_MAX_UPLOAD_BYTES: '52428800',
    KNOWLEDGE_ALLOWED_MIME_TYPES:
      'application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown',
    KNOWLEDGE_SERVICE_AUTH_MODE: 'disabled',
    KNOWLEDGE_PROCESSING_REDIS_HOST: root.REDIS_HOST || '127.0.0.1',
    KNOWLEDGE_PROCESSING_REDIS_PORT: root.REDIS_PORT || '6379',
    KNOWLEDGE_PROCESSING_REDIS_PASSWORD: root.REDIS_PASSWORD,
    KNOWLEDGE_PROCESSING_QUEUE_PREFIX: 'amani:development:knowledge',
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
    'Knowledge .env prepared (mode 600). Existing keys were preserved; local MinIO root credentials are server-only and should later be replaced with a scoped account.',
  );
} catch {
  console.error(
    'Knowledge .env could not be prepared. Check root .env and merge the example manually.',
  );
  process.exitCode = 1;
}
