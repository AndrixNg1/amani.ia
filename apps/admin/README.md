# @amani/admin — Administration interface

Administration interface for platform operations. This is currently the original Next.js starter page, with no backend
client or authentication. It uses Next.js 16.3.6 (App Router), React 19,
TypeScript, Tailwind CSS 4 and ESLint. Existing dependencies are preserved.

## Responsibilities and relationships

Platform and organization administration are planned; no admin roles, sessions or screens are implemented.
The intended service boundary is this frontend → Gateway (`http://127.0.0.1:4000`)
→ Core API / AI Orchestrator / independent Plugin APIs. Browser code must not
receive backend credentials. Server-side UI checks do not replace authorization
in every backend. See the [architecture](../../docs/architecture/README.md).

## Environment and development

Install once at the repository root using the [manual setup](../../README.md).
No custom environment variable is currently consumed. The optional `.env.example`
reserves `GATEWAY_API_URL` for a future server-side client; it is commented out
because that client does not exist. Copy it to `apps/admin/.env.local` only when
local values are needed. Never put secrets in `NEXT_PUBLIC_*` variables.

Run from the repository root:

```bash
npm run dev:admin
npm run lint:check --workspace=@amani/admin
npm run typecheck --workspace=@amani/admin
npm run build --workspace=@amani/admin
npm run start --workspace=@amani/admin
```

Development and production preview bind to `127.0.0.1:3002`. `package.json`
sets the port explicitly because Next.js cannot read `PORT` from dotenv before
starting its server. Override directly with
`npm run dev --workspace=@amani/admin -- --port 3102`.
Use `--hostname 0.0.0.0` explicitly only when a deployment requires it.
Turbopack resolves the monorepo root explicitly, including future shared packages.

## Validation and current gaps

`typecheck` runs `next typegen` before TypeScript so generated `LayoutProps` types
exist on a fresh checkout. Generated types and build output are ignored.
`lint:check` does not fix files; the original `lint` command remains available.
The original layout uses Google Geist fonts, so production builds need network
access to retrieve them. No frontend unit, component or browser tests exist and
there is no `test` script. The root `npm test` therefore fails visibly until real
frontend suites are added; `npm run test:backend` covers only Nest services.

There is no dedicated frontend health endpoint. Manually open
`http://127.0.0.1:3002` after starting the app. No real organization or customer
data should be introduced until the authentication and authorization foundation
is implemented. Follow [AGENTS.md](AGENTS.md) when changing Next.js source.
