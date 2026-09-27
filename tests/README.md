# Repository-wide tests

The [integration](integration/README.md), [contracts](contracts/README.md), and [e2e](e2e/README.md) directories reserve future cross-project test suites. They contain documentation only: there is no test runner, package manifest, environment configuration, or runnable repository-wide suite here.

Existing NestJS starter tests live in each backend workspace's `src/` and `test/` directories. Run them through the workspace scripts described in the [root README](../README.md). These starter checks do not validate service integration, tenant isolation, database behavior, or AI authorization. Frontend test coverage remains to be implemented.

Future suites must use synthetic fixtures and isolated local test services. Never commit customer data, credentials, generated reports, or database snapshots. Negative organization-authorization cases are required before business data is handled; see the [authorization requirements](../docs/architecture/authorization.md).
