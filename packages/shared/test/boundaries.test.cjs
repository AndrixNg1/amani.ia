const { test, expect } = require('@jest/globals');
const { readFileSync, readdirSync, existsSync } = require('node:fs');
const { resolve, relative, sep } = require('node:path');
const { isBuiltin } = require('node:module');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');

const packagesRoot = resolve(__dirname, '../..');
const names = ['types', 'contracts', 'config', 'shared'];
const allowedDependencies = {
  types: [], contracts: ['@amani/types'], config: [], shared: ['@amani/types'],
};
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : path.endsWith('.ts') ? [path] : [];
  });
}

test('shared package manifests preserve the intended acyclic dependency graph', () => {
  const graph = new Map();
  for (const name of names) {
    const manifest = readJson(resolve(packagesRoot, name, 'package.json'));
    expect(manifest.name).toBe(`@amani/${name}`);
    expect(manifest.private).toBe(true);
    const dependencies = Object.keys({
      ...manifest.dependencies, ...manifest.peerDependencies, ...manifest.optionalDependencies,
    });
    expect(dependencies.sort()).toEqual(allowedDependencies[name]);
    for (const [dependency, version] of Object.entries({ ...manifest.devDependencies, ...manifest.dependencies })) {
      if (dependency.startsWith('@amani/')) expect(allowedDependencies[name]).toContain(dependency);
      expect(version).not.toMatch(/(?:apps|plugins|workers)[/\\]/);
    }
    graph.set(manifest.name, dependencies);
  }

  function visit(name, ancestors = new Set()) {
    expect(ancestors.has(name)).toBe(false);
    for (const dependency of graph.get(name) ?? []) {
      visit(dependency, new Set([...ancestors, name]));
    }
  }
  for (const name of graph.keys()) visit(name);
  for (const name of ['sdk', 'prompts', 'ui']) {
    expect(existsSync(resolve(packagesRoot, name, 'package.json'))).toBe(false);
    expect(existsSync(resolve(packagesRoot, name, 'src'))).toBe(false);
  }
});

test('source imports cannot bypass package boundaries or add undeclared dependencies', () => {
  for (const name of names) {
    const sourceRoot = resolve(packagesRoot, name, 'src');
    for (const file of sourceFiles(sourceRoot)) {
      const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);

      function check(specifier) {
        if (specifier.startsWith('.')) {
          const target = resolve(file, '..', specifier);
          const path = relative(sourceRoot, target);
          expect(path === '..' || path.startsWith(`..${sep}`)).toBe(false);
        } else if (isBuiltin(specifier)) {
          expect(['config', 'shared']).toContain(name);
        } else {
          expect(allowedDependencies[name]).toContain(specifier);
        }
      }

      function walk(node) {
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
          if (node.moduleSpecifier) {
            expect(ts.isStringLiteral(node.moduleSpecifier)).toBe(true);
            check(node.moduleSpecifier.text);
          }
        }
        if (ts.isCallExpression(node) && (
          node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === 'require')
        )) {
          expect(node.arguments.length).toBe(1);
          expect(ts.isStringLiteral(node.arguments[0])).toBe(true);
          check(node.arguments[0].text);
        }
        if (ts.isImportTypeNode(node)) {
          expect(ts.isLiteralTypeNode(node.argument)).toBe(true);
          expect(ts.isStringLiteral(node.argument.literal)).toBe(true);
          check(node.argument.literal.text);
        }
        ts.forEachChild(node, walk);
      }
      walk(source);
    }
  }
});

test.each([
  ['shared', 'createRequestId'],
])('%s exposes its compiled entry point to both CommonJS and ESM', (name, exported) => {
  const cwd = resolve(packagesRoot, name);
  // Self-reference exercises package exports without manufacturing workspace links.
  execFileSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    assert.equal(typeof require('@amani/${name}').${exported}, 'function');
  `], { cwd });
  execFileSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { ${exported} } from '@amani/${name}';
    assert.equal(typeof ${exported}, 'function');
  `], { cwd });
});
