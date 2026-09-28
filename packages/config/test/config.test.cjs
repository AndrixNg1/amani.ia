const { describe, test, expect } = require('@jest/globals');
const { inspect } = require('node:util');
const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');
const { createEnv, ConfigurationError } = require('../dist/index.js');

function rejectsWith(callback, code, variable = 'VALUE') {
  expect(callback).toThrow(ConfigurationError);
  try {
    callback();
  } catch (error) {
    expect(error.code).toBe(code);
    expect(error.variable).toBe(variable);
  }
}

describe('required values', () => {
  test.each([undefined, '', '  \t '])('rejects missing or empty value %p', (value) => {
    rejectsWith(() => createEnv({ VALUE: value }).required('VALUE'), 'required');
  });

  test('preserves secret contents without trimming or changing them', () => {
    expect(createEnv({ VALUE: '  synthetic-secret  ' }).required('VALUE'))
      .toBe('  synthetic-secret  ');
  });

  test('reads only explicitly supplied own properties', () => {
    const source = Object.create({ VALUE: 'inherited-value' });
    rejectsWith(() => createEnv(source).required('VALUE'), 'required');
    rejectsWith(() => createEnv({}).required('PATH'), 'required', 'PATH');
  });

  test('rejects invalid names and non-string JavaScript input without echoing it', () => {
    rejectsWith(() => createEnv({}).required('secret\ninput'), 'invalid_variable_name', '<variable>');
    rejectsWith(() => createEnv({ VALUE: 123 }).required('VALUE'), 'invalid_string');
  });
});

describe('integer parsing', () => {
  test.each([['0', 0], ['-12', -12], ['+42', 42], [' 4000 ', 4000]])('parses %s', (raw, expected) => {
    expect(createEnv({ VALUE: raw }).integer('VALUE')).toBe(expected);
  });

  test.each(['', ' ', '12px', '1.5', '1e3', '0x10', 'Infinity', 'NaN', '9007199254740992'])(
    'rejects ambiguous or unsafe integer %p', (raw) => {
      rejectsWith(() => createEnv({ VALUE: raw }).integer('VALUE'), 'invalid_integer');
    });

  test('validates defaults and inclusive bounds', () => {
    expect(createEnv({}).integer('VALUE', { default: 0, min: 0, max: 0 })).toBe(0);
    rejectsWith(() => createEnv({}).integer('VALUE'), 'required');
    rejectsWith(() => createEnv({}).integer('VALUE', { default: 1.5 }), 'invalid_integer');
    rejectsWith(() => createEnv({}).integer('VALUE', { default: 70000, min: 1, max: 65535 }), 'out_of_range');
    rejectsWith(() => createEnv({ VALUE: '0' }).integer('VALUE', { min: 1 }), 'out_of_range');
    rejectsWith(() => createEnv({ VALUE: '5' }).integer('VALUE', { min: 2, max: 1 }), 'invalid_bounds');
    rejectsWith(() => createEnv({ VALUE: '5' }).integer('VALUE', { max: NaN }), 'invalid_bounds');
    rejectsWith(() => createEnv({ VALUE: '' }).integer('VALUE', { default: 42 }), 'invalid_integer');
  });
});

describe('booleans and environment names', () => {
  test('parses true/false explicitly instead of applying truthiness', () => {
    expect(createEnv({ VALUE: 'false' }).boolean('VALUE')).toBe(false);
    expect(createEnv({ VALUE: ' true ' }).boolean('VALUE')).toBe(true);
    expect(createEnv({}).boolean('VALUE', { default: false })).toBe(false);
    rejectsWith(() => createEnv({}).boolean('VALUE'), 'required');
    rejectsWith(() => createEnv({}).boolean('VALUE', { default: 'false' }), 'invalid_boolean');
  });

  test.each(['yes', '0', '1', 'TRUE', ''])('rejects ambiguous boolean %p', (raw) => {
    rejectsWith(() => createEnv({ VALUE: raw }).boolean('VALUE'), 'invalid_boolean');
  });

  test.each(['development', 'test', 'staging', 'production'])('accepts environment %s', (value) => {
    expect(createEnv({ VALUE: value }).environment('VALUE')).toBe(value);
  });

  test('environment defaults do not mask invalid supplied values', () => {
    expect(createEnv({}).environment('VALUE', { default: 'development' })).toBe('development');
    rejectsWith(() => createEnv({}).environment('VALUE'), 'required');
    rejectsWith(() => createEnv({ VALUE: 'prod' }).environment('VALUE', { default: 'production' }), 'invalid_environment');
    rejectsWith(() => createEnv({}).environment('VALUE', { default: 'unknown' }), 'invalid_environment');
  });
});

describe('URL parsing and error safety', () => {
  test('accepts absolute HTTP(S) URLs, with explicit protocols for other server URLs', () => {
    expect(createEnv({ VALUE: 'https://example.test/path?q=1' }).url('VALUE'))
      .toBe('https://example.test/path?q=1');
    const value = 'postgresql://synthetic:credential@localhost:5432/example';
    expect(createEnv({ VALUE: value }).url('VALUE', { protocols: ['postgresql:'] })).toBe(value);
    expect(createEnv({}).url('VALUE', { default: 'http://localhost:4000' })).toBe('http://localhost:4000');
  });

  test.each(['/relative', 'https:example.test', 'https:///example.test', 'javascript:alert(1)', 'file:///tmp/file', 'ftp://example.test', 'https://example.test:99999', 'https://exa\nmple.test', ' https://example.test', 'https://example.test/a b', 'https://example.test\\secret'])(
    'rejects unsafe or unsupported URL %p', (value) => {
      rejectsWith(() => createEnv({ VALUE: value }).url('VALUE'), 'invalid_url');
    });

  test('validates URL defaults and protocol declarations', () => {
    rejectsWith(() => createEnv({}).url('VALUE'), 'required');
    rejectsWith(() => createEnv({}).url('VALUE', { default: '/relative' }), 'invalid_url');
    rejectsWith(() => createEnv({ VALUE: 'https://example.test' }).url('VALUE', { protocols: [] }), 'invalid_protocols');
    rejectsWith(() => createEnv({ VALUE: 'https://example.test' }).url('VALUE', { protocols: ['https'] }), 'invalid_protocols');
  });

  test('never retains a URL parser error, secret input, or raw configuration object', () => {
    const secret = 'SYNTHETIC_SECRET_DO_NOT_ECHO';
    const env = createEnv({ VALUE: `https://user:${secret}@invalid host` });
    try {
      env.url('VALUE');
      throw new Error('Expected a configuration error');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error.cause).toBeUndefined();
      for (const text of [error.message, error.stack, String(error), JSON.stringify(error), inspect(error)]) {
        expect(text).not.toContain(secret);
        expect(text).not.toContain('invalid host');
      }
    }
  });

  test('package exports block browser resolution', () => {
    const output = execFileSync(process.execPath, ['--conditions=browser', '-e', `
      const assert = require('node:assert/strict');
      assert.throws(() => require('@amani/config'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
      process.stdout.write('blocked');
    `], { cwd: resolve(__dirname, '..'), encoding: 'utf8' });
    expect(output).toBe('blocked');
  });

  test('compiled exports work in CommonJS and ESM server consumers', () => {
    const cwd = resolve(__dirname, '..');
    execFileSync(process.execPath, ['-e', `
      const assert = require('node:assert/strict');
      assert.equal(typeof require('@amani/config').createEnv, 'function');
    `], { cwd });
    execFileSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import { createEnv } from '@amani/config';
      assert.equal(typeof createEnv, 'function');
    `], { cwd });
  });
});
