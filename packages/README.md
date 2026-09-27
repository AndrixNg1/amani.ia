# Shared packages

This directory reserves shared code boundaries for the applications and Plugin APIs. Its child directories are documentation placeholders: none currently has a `package.json`, source code, dependencies, environment variables, development commands, or tests.

The root npm workspace pattern includes `packages/*`; a directory becomes an actual workspace only after it has a package manifest. Future initialized packages should use `@amani/<name>` names and explicit dependencies. No packages are initialized by this setup.

| Directory | Intended responsibility | Intended consumers |
| --- | --- | --- |
| [config](config/README.md) | Shared tool and configuration conventions | Apps, plugins, and future packages |
| [contracts](contracts/README.md) | API and event contracts with validation boundaries | Gateway, Core API, orchestrator, plugins, SDK |
| [prompts](prompts/README.md) | Versioned prompt templates and metadata | AI Orchestrator and AI-capable plugins |
| [sdk](sdk/README.md) | Typed clients for supported service interfaces | Applications and approved API consumers |
| [shared](shared/README.md) | Small common utilities | Apps, plugins, future workers |
| [types](types/README.md) | Compile-time domain types | TypeScript projects |
| [ui](ui/README.md) | Shared presentation components | Website, enterprise, admin |

TypeScript is the intended fit for shared code in this repository; package build tools and public APIs remain undecided. Each package README explains its proposed boundary. Do not infer that any current application imports these directories.
