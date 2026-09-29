// Tests only the shell boundary with a fake psql. No database/container is contacted.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const script = resolve(dirname(fileURLToPath(import.meta.url)), 'init/002-service-isolation.sh');
const bash = execFileSync('/bin/sh', ['-c', 'command -v bash'], { encoding: 'utf8' }).trim();
const dirnameBinary = execFileSync('/bin/sh', ['-c', 'command -v dirname'], { encoding: 'utf8' }).trim();
const passwordNames = ['POSTGRES_PASSWORD', 'CORE_PLATFORM_DB_PASSWORD', 'KNOWLEDGE_DB_PASSWORD',
  'DATA_ANALYTICS_DB_PASSWORD', 'CONVERSATIONS_DB_PASSWORD', 'CONNECTORS_DB_PASSWORD', 'EVALUATION_DB_PASSWORD'];

function run(overrides, inspect) {
  const temporary = mkdtempSync(join(tmpdir(), 'amani-bootstrap-test-'));
  try {
    symlinkSync(dirnameBinary, join(temporary, 'dirname'));
    writeFileSync(join(temporary, 'psql'), `#!/bin/sh
printf '%s\\n' "$@" > "$AMANI_TEST_ARGS_FILE"
if [ "\${AMANI_TEST_FAIL_PSQL:-}" = "1" ]; then
  printf '%s\\n' "$KNOWLEDGE_DB_PASSWORD" >&2
  exit 1
fi
`, { mode: 0o700 });
    const environment = {
      PATH: temporary, // Only the fake psql and dirname are reachable.
      POSTGRES_USER: 'amani', POSTGRES_DB: 'amani',
      AMANI_TEST_ARGS_FILE: join(temporary, 'arguments'),
      ...Object.fromEntries(passwordNames.map((name, index) => [name, `synthetic-secret-${index}`])),
      ...overrides,
    };
    const result = spawnSync(bash, [script], { env: environment, encoding: 'utf8' });
    assert.equal(result.error, undefined);
    const called = existsSync(environment.AMANI_TEST_ARGS_FILE);
    inspect(result, called ? readFileSync(environment.AMANI_TEST_ARGS_FILE, 'utf8') : null);
  } finally {
    rmSync(temporary, { recursive: true, force: true }); // Only our isolated test directory.
  }
}

test('missing service password is rejected before any SQL client call', () => {
  run({ KNOWLEDGE_DB_PASSWORD: '' }, (result, args) => {
    assert.equal(result.status, 1);
    assert.equal(args, null);
    assert.match(result.stderr, /required variable KNOWLEDGE_DB_PASSWORD is missing/);
    assert.doesNotMatch(result.stderr, /synthetic-secret/);
  });
});

test('bootstrap administrator cannot be a service role', () => {
  run({ POSTGRES_USER: 'amani_knowledge' }, (result, args) => {
    assert.equal(result.status, 1);
    assert.equal(args, null);
    assert.match(result.stderr, /separate administrator/);
  });
});

test('administrative databases are reserved', () => {
  run({ POSTGRES_DB: 'postgres' }, (result, args) => {
    assert.equal(result.status, 1);
    assert.equal(args, null);
    assert.match(result.stderr, /dedicated POSTGRES_DB/);
  });
});

test('database connection strings and malformed identifiers are rejected', () => {
  run({ POSTGRES_DB: 'dbname=amani password=synthetic-secret' }, (result, args) => {
    assert.equal(result.status, 1);
    assert.equal(args, null);
    assert.doesNotMatch(result.stderr, /synthetic-secret/);
  });
});

test('reusing credentials between services is rejected without displaying values', () => {
  run({ KNOWLEDGE_DB_PASSWORD: 'synthetic-secret-0' }, (result, args) => {
    assert.equal(result.status, 1);
    assert.equal(args, null);
    assert.match(result.stderr, /must be distinct/);
    assert.match(result.stderr, /POSTGRES_PASSWORD and KNOWLEDGE_DB_PASSWORD match/);
    assert.doesNotMatch(result.stderr, /synthetic-secret/);
  });
});

test('valid configuration calls the mocked client transactionally without password argv', () => {
  run({ KNOWLEDGE_DB_PASSWORD: 'synthetic-quote-\'-$(`never-execute`)' }, (result, args) => {
    assert.equal(result.status, 0);
    assert.match(args, /--single-transaction/);
    assert.match(args, /--set=ON_ERROR_STOP=1/);
    assert.doesNotMatch(args, /synthetic/);
    assert.match(result.stdout, /ownership bootstrap completed/);
    assert.equal(result.stderr, '');
  });
});

test('a mocked SQL failure remains a failure and does not leak its secret error output', () => {
  run({ AMANI_TEST_FAIL_PSQL: '1' }, (result, args) => {
    assert.equal(result.status, 1);
    assert.notEqual(args, null);
    assert.match(result.stderr, /transaction rolled back/);
    assert.doesNotMatch(result.stderr + result.stdout, /synthetic-secret/);
  });
});
