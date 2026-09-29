// Static policy check only: no daemon calls, image pulls, SQL or container startup.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const local = process.argv.includes('--local');
const environmentFile = local ? '.env' : '.env.example';
let model;
try {
  model = JSON.parse(execFileSync('docker', [
    'compose', '--file', 'docker-compose.yml', '--env-file', environmentFile,
    'config', '--format', 'json',
  ], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
} catch {
  console.error(`FAIL: Compose validation using ${environmentFile}. Use docker compose --env-file ${environmentFile} config --quiet for diagnostics.`);
  process.exit(1);
}

assert.deepEqual(Object.keys(model.services).sort(), ['minio', 'postgres', 'redis']);
assert.equal(model.networks.dependencies.internal, true, 'Dependencies need an internal network');
assert.deepEqual(Object.keys(model.networks).sort(), ['dependencies', 'host_access']);
assert.notEqual(model.networks.host_access.internal, true, 'Host port publishing needs a non-internal bridge');
assert.equal(model.networks.host_access.driver_opts['com.docker.network.bridge.host_binding_ipv4'], '127.0.0.1');
assert.deepEqual(Object.keys(model.volumes).sort(), ['minio_data', 'postgres_data', 'redis_data']);
const expectedPorts = { postgres: [5432], redis: [6379], minio: [9000, 9001] };
const dataTargets = { postgres: '/var/lib/postgresql/data', redis: '/data', minio: '/data' };
for (const [name, service] of Object.entries(model.services)) {
  assert.equal(service.restart, 'no', `${name}: surface init errors instead of restarting silently`);
  assert.ok(!service.privileged && !service.network_mode, `${name}: no privileged/host networking`);
  assert.deepEqual(Object.keys(service.networks).sort(), ['dependencies', 'host_access']);
  assert.ok(service.healthcheck?.test?.length && !service.healthcheck.disable, `${name}: healthcheck required`);
  assert.deepEqual(service.ports.map((port) => port.target).sort((a, b) => a - b), expectedPorts[name]);
  for (const port of service.ports) {
    assert.equal(port.host_ip, '127.0.0.1', `${name}: published ports must be loopback only`);
  }
  assert.ok(service.volumes.some((volume) => volume.type === 'volume'
    && volume.source === `${name}_data` && volume.target === dataTargets[name]), `${name}: persistent volume missing`);
}
const postgres = model.services.postgres;
const passwordNames = ['POSTGRES_PASSWORD', 'CORE_PLATFORM_DB_PASSWORD', 'KNOWLEDGE_DB_PASSWORD',
  'DATA_ANALYTICS_DB_PASSWORD', 'CONVERSATIONS_DB_PASSWORD', 'CONNECTORS_DB_PASSWORD', 'EVALUATION_DB_PASSWORD'];
const passwordOwners = new Map();
for (const name of passwordNames) {
  const value = postgres.environment[name];
  if (typeof value !== 'string' || value.length === 0) {
    console.error(`FAIL: ${name} must be nonempty in ${environmentFile}.`);
    process.exit(1);
  }
  if (passwordOwners.has(value)) {
    console.error(`FAIL: ${passwordOwners.get(value)} and ${name} must have different passwords in ${environmentFile}.`);
    process.exit(1);
  }
  passwordOwners.set(value, name);
}
assert.equal(postgres.environment.POSTGRES_HOST_AUTH_METHOD, 'scram-sha-256');
assert.ok(postgres.environment.POSTGRES_INITDB_ARGS.includes('--auth-host=scram-sha-256'));
for (const service of ['CORE_PLATFORM', 'KNOWLEDGE', 'DATA_ANALYTICS', 'CONVERSATIONS', 'CONNECTORS', 'EVALUATION']) {
  assert.ok(typeof postgres.environment[`${service}_DB_PASSWORD`] === 'string'
    && postgres.environment[`${service}_DB_PASSWORD`].length > 0, `${service}: password configuration missing`);
}
assert.ok(postgres.volumes.some((volume) => volume.type === 'bind' && volume.read_only
  && volume.target === '/docker-entrypoint-initdb.d'));
const minio = model.services.minio;
assert.equal(minio.pull_policy, 'build', 'MinIO must build locally instead of pulling the unavailable image');
assert.equal(resolve(root, minio.build.context), resolve(root, 'infrastructure/storage/minio'),
  'MinIO build context must exclude the root environment and application files');
assert.ok(existsSync(resolve(minio.build.context, minio.build.dockerfile ?? 'Dockerfile')));
console.log(`PASS: ${environmentFile}, Compose services, networks, loopback ports, volumes, healthchecks and distinct PostgreSQL credentials.`);

for (const script of ['infrastructure/postgres/init/002-service-isolation.sh', 'infrastructure/postgres/verify.sh']) {
  execFileSync('bash', ['-n', script], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
}
assert.ok(statSync(resolve(root, 'infrastructure/postgres/init/002-service-isolation.sh')).mode & 0o111,
  'Entrypoint shell script must be executable');
for (const script of ['001-vector.sql', 'sql/bootstrap.sql', 'sql/service.sql']) {
  assert.ok(existsSync(resolve(root, 'infrastructure/postgres/init', script)));
}
const example = readFileSync(resolve(root, '.env.example'), 'utf8');
assert.ok(example.includes('NEXT_PUBLIC_'), 'Document the browser credential boundary');
console.log('PASS: shell syntax and initialization file layout.');
console.log('NOT RUN by this static check: image compilation, SQL execution, authentication/privilege enforcement, image startup and runtime healthchecks.');
