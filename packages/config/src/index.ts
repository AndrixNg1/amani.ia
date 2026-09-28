import { URL } from 'node:url';

/** Pass process.env explicitly from server code, or a synthetic object in tests. */
export type EnvironmentSource = Readonly<Record<string, string | undefined>>;
export type EnvironmentName = 'development' | 'test' | 'staging' | 'production';

export type ConfigurationIssue =
  | 'invalid_variable_name'
  | 'required'
  | 'invalid_string'
  | 'invalid_integer'
  | 'invalid_bounds'
  | 'out_of_range'
  | 'invalid_boolean'
  | 'invalid_url'
  | 'invalid_protocols'
  | 'invalid_environment';

/** Contains only a validated variable name and a fixed code, never its value/cause. */
export class ConfigurationError extends Error {
  readonly variable: string;
  readonly code: ConfigurationIssue;

  constructor(variable: string, code: ConfigurationIssue) {
    const safeName = /^[A-Za-z_][A-Za-z0-9_]*$/.test(variable)
      ? variable
      : '<variable>';
    super(`Invalid configuration: ${safeName} (${code}).`);
    this.name = 'ConfigurationError';
    this.variable = safeName;
    this.code = code;
  }
}

export interface IntegerOptions {
  readonly default?: number;
  readonly min?: number;
  readonly max?: number;
}

export interface BooleanOptions {
  readonly default?: boolean;
}

export interface UrlOptions {
  readonly default?: string;
  /** Lowercase schemes including ':'. Defaults to HTTP(S). */
  readonly protocols?: readonly string[];
}

export interface EnvironmentOptions {
  readonly default?: EnvironmentName;
}

function fail(name: string, code: ConfigurationIssue): never {
  throw new ConfigurationError(name, code);
}

/**
 * Server-only, lazy readers. Each call rejects its first invalid value immediately.
 * No dotenv loading, implicit process.env reads, logging, or global configuration.
 */
export function createEnv(source: EnvironmentSource) {
  function read(name: string): string | undefined {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      fail('<variable>', 'invalid_variable_name');
    }
    const value = Object.hasOwn(source, name) ? source[name] : undefined;
    if (value !== undefined && typeof value !== 'string') {
      fail(name, 'invalid_string');
    }
    return value;
  }

  function required(name: string): string {
    const value = read(name);
    if (value === undefined || value.trim() === '') fail(name, 'required');
    // Preserve secret values exactly, including intentional surrounding spaces.
    return value;
  }

  function integer(name: string, options: IntegerOptions = {}): number {
    const raw = read(name);
    const { min, max } = options;
    if (
      (min !== undefined && !Number.isSafeInteger(min)) ||
      (max !== undefined && !Number.isSafeInteger(max)) ||
      (min !== undefined && max !== undefined && min > max)
    ) fail(name, 'invalid_bounds');

    let value: number;
    if (raw === undefined) {
      if (options.default === undefined) fail(name, 'required');
      value = options.default;
    } else {
      if (!/^[+-]?\d+$/.test(raw.trim())) fail(name, 'invalid_integer');
      value = Number(raw.trim());
    }
    if (!Number.isSafeInteger(value)) fail(name, 'invalid_integer');
    if ((min !== undefined && value < min) || (max !== undefined && value > max)) {
      fail(name, 'out_of_range');
    }
    return value;
  }

  function boolean(name: string, options: BooleanOptions = {}): boolean {
    const raw = read(name);
    if (raw === undefined) {
      if (options.default === undefined) fail(name, 'required');
      if (typeof options.default !== 'boolean') fail(name, 'invalid_boolean');
      return options.default;
    }
    if (raw.trim() === 'true') return true;
    if (raw.trim() === 'false') return false;
    fail(name, 'invalid_boolean');
  }

  function url(name: string, options: UrlOptions = {}): string {
    const raw = read(name);
    const value = raw ?? options.default;
    if (value === undefined) fail(name, 'required');
    const protocols = options.protocols ?? ['http:', 'https:'];
    if (
      !Array.isArray(protocols) || protocols.length === 0 ||
      protocols.some((protocol) => typeof protocol !== 'string' || !/^[a-z][a-z0-9+.-]*:$/.test(protocol))
    ) fail(name, 'invalid_protocols');
    // Reject normalizations that silently discard control characters or infer a host.
    if (
      typeof value !== 'string' || value !== value.trim() ||
      // eslint-disable-next-line no-control-regex -- Reject control characters before URL normalization.
      /[\s\\\u0000-\u001f\u007f]/.test(value) ||
      !/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/]/.test(value)
    ) fail(name, 'invalid_url');
    try {
      const parsed = new URL(value);
      if (!parsed.hostname || !protocols.includes(parsed.protocol)) fail(name, 'invalid_url');
    } catch {
      // URL parser exceptions can contain credentials: never retain or rethrow them.
      fail(name, 'invalid_url');
    }
    // Return the original validated string; callers must keep credential URLs private.
    return value;
  }

  function environment(name: string, options: EnvironmentOptions = {}): EnvironmentName {
    const raw = read(name);
    const value = raw === undefined ? options.default : raw.trim();
    if (value === undefined) fail(name, 'required');
    switch (value) {
      case 'development':
      case 'test':
      case 'staging':
      case 'production':
        return value;
      default:
        fail(name, 'invalid_environment');
    }
  }

  return Object.freeze({ required, integer, boolean, url, environment });
}
