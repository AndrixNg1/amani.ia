# Gateway infrastructure boundary

Status: documentation only. No reverse proxy, ingress, TLS configuration, extra
container, port, credential or runtime test is configured here.

The NestJS API Gateway belongs to [apps/gateway](../../apps/gateway/README.md), whose
development port is 4000. This directory is reserved for future edge
infrastructure, never Gateway application modules, routing business logic or IAM.

Future edge configuration may terminate TLS and forward browser requests to the
Gateway. Select the proxy/provider through the deployment ADR process. Forwarded
headers, origin policy, size/rate limits and private backend exposure need explicit
configuration and tests. Arbitrary organization/user headers and private networking
must not establish trust; each receiving API still authenticates and authorizes.
No proxy may grant cross-tenant access or replace resource permission checks.

There are no directory-specific environment variables, volumes, startup/shutdown
commands or tests yet. The dependency stack is managed through
[infrastructure](../README.md): `infra:config`/`infra:check` are static;
`infra:up`/`infra:status`/`infra:logs`/`infra:down` are owner lifecycle commands.
Compose provisions no edge service. Production routing/TLS remains separate from
Gateway application functionality under ADR-0003/0029.
