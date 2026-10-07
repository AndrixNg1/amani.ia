# @amani/config

Server environment readers with runtime tests.
No application configuration has been migrated.

## Purpose and boundaries

Framework-independent validation for NestJS, Next.js **server code** and future
Node workers. No implicit `process.env` reads, dotenv loading, logging, credentials,
configuration singleton, database client or service-specific variable schema.

`createEnv(source)` accepts an explicit `Readonly<Record<string, string | undefined>>`
and reads only requested own properties. Creating the reader alone validates nothing:
call all required readers at startup and let `ConfigurationError` stop startup on
invalid input.

## Usage

```ts
import { createEnv } from '@amani/config';

// Server startup only.
const env = createEnv(process.env);
const serverConfig = Object.freeze({
  port: env.integer('PORT', { default: 4000, min: 1, max: 65535 }),
  debug: env.boolean('DEBUG', { default: false }),
  environment: env.environment('APP_ENV', { default: 'development' }),
  serviceUrl: env.url('SERVICE_URL', { protocols: ['https:'] }),
  serviceSecret: env.required('SERVICE_SECRET'),
});
// Keep serverConfig in the server module. Never send it to clients or log it.
```

| Reader | Behavior |
| --- | --- |
| `required(name)` | Rejects missing/empty/whitespace-only values; preserves valid secret contents exactly |
| `integer(name, { default?, min?, max? })` | Trims whitespace; signed base-10 safe integers only; inclusive integer bounds |
| `boolean(name, { default? })` | Trims whitespace; only lowercase `true` and `false`, never truthiness coercion |
| `url(name, { default?, protocols? })` | Absolute URL with hostname; no whitespace, controls or backslashes; HTTP(S) by default; explicit other schemes with trailing `:` |
| `environment(name, { default? })` | `development`, `test`, `staging`, `production`, after trimming |

Defaults apply only to absent (`undefined`) variables and are validated when used.
Malformed/empty supplied values fail rather than silently using defaults. Integer
parsing rejects partial values, fractions, exponent/hex notation and unsafe numbers.
`APP_ENV` may describe staging; preserve framework-specific `NODE_ENV` conventions
when integrating Next.js. URL validation does not establish reachability, trust,
DNS safety or an SSRF policy.

## Secrets and server boundary

No environment values are exported. `ConfigurationError` contains a validated
variable name and fixed issue code, never the rejected value or URL parser cause.
The readers do not log. Returned configuration may contain secrets: callers must
not serialize it, send it as server-rendered props or put it in `NEXT_PUBLIC_*`.
The package blocks the `browser` export condition and exports runtime code to Node
only. This boundary does not redact data deliberately sent by a server.

No runtime/internal dependencies; only `node:url`. No validation library is added
(the repository had no declared shared validator). TypeScript, ESLint, Jest and
necessary types are explicit development dependencies.

## Validation and future integration

```bash
npm run build --workspace=@amani/config
npm run typecheck --workspace=@amani/config
npm run lint:check --workspace=@amani/config
npm run test --workspace=@amani/config -- --runInBand
```

Tests build first and exercise emitted code: invalid/missing values, bounds,
booleans, defaults, URL safety, secret non-disclosure, CommonJS/ESM exports and browser
rejection. Type checks also include compile-time usage fixtures.

Future services define their own startup schemas; Python workers need Python-side
validation. See [package setup](../README.md) and
[ADR-0028](../../docs/architecture/adr/0028-observability-resilience-secrets.md).
