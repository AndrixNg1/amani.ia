import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const manifest = readJson(join(root, 'package.json'));
assert.equal(manifest.private, true, 'Root package must stay private');
assert.deepEqual(manifest.workspaces, ['apps/*', 'plugins/*', 'packages/*']);
assert.ok(!existsSync(join(root, 'npm-workspace.yaml')), 'Obsolete npm workspace YAML');

const ports = new Map([
  ['website', 3000], ['enterprise', 3001], ['admin', 3002],
  ['gateway', 4000], ['core-api', 4001], ['ai-orchestrator', 4002],
  ['knowledge', 4101], ['data-analytics', 4102], ['conversations', 4103],
  ['connectors', 4104], ['evaluation', 4105],
]);
assert.equal(new Set(ports.values()).size, ports.size, 'Duplicate application ports');
const names = new Set();
const missingTests = [];
let initialized = 0;

for (const group of ['apps', 'plugins', 'packages', 'workers', 'infrastructure']) {
  for (const entry of readdirSync(join(root, group), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = join(root, group, entry.name);
    assert.ok(existsSync(join(path, 'README.md')), `Missing README: ${group}/${entry.name}`);
    assert.ok(!existsSync(join(path, '.git')), `Nested Git repository: ${group}/${entry.name}`);
    if (!existsSync(join(path, 'package.json'))) {
      assert.ok(!['apps', 'plugins'].includes(group), `Missing manifest: ${group}/${entry.name}`);
      continue;
    }
    const pkg = readJson(join(path, 'package.json'));
    assert.equal(pkg.name, `@amani/${entry.name}`, `Wrong package name in ${group}/${entry.name}`);
    assert.ok(!names.has(pkg.name), `Duplicate name: ${pkg.name}`);
    names.add(pkg.name);
    assert.equal(pkg.private, true, `${pkg.name} must stay private`);
    for (const task of ['build', 'lint:check', 'typecheck']) {
      assert.ok(pkg.scripts?.[task], `Missing ${task} script in ${pkg.name}`);
    }
    if (!pkg.scripts?.test) missingTests.push(pkg.name);
    if (group !== 'packages' && group !== 'workers') {
      assert.ok(existsSync(join(path, '.env.example')), `Missing environment example: ${pkg.name}`);
      const port = ports.get(entry.name);
      assert.ok(port, `Document a unique port for ${pkg.name}`);
      if (pkg.dependencies?.next) {
        for (const task of ['dev', 'start']) {
          assert.ok(pkg.scripts[task].includes(`--port ${port}`), `Wrong ${task} port: ${pkg.name}`);
        }
      } else {
        const env = readFileSync(join(path, '.env.example'), 'utf8');
        assert.ok(env.split(/\r?\n/).includes(`PORT=${port}`), `Wrong PORT: ${pkg.name}`);
        assert.ok(pkg.scripts?.['test:e2e'], `Missing HTTP tests: ${pkg.name}`);
      }
    }
    initialized++;
  }
}

for (const task of ['lint', 'typecheck', 'test', 'build']) {
  assert.ok(manifest.scripts[task], `Missing root ${task}`);
  assert.ok(!manifest.scripts[task].includes('--if-present'), `${task} silently skips missing scripts`);
}
console.log(`Structure verified: ${initialized} initialized packages; unique names, ports and component READMEs.`);
console.log('This is a static structural check, not runtime validation or a test-coverage gate.');
if (missingTests.length) {
  console.log(`Missing test suites (root npm test must fail): ${missingTests.join(', ')}`);
}
