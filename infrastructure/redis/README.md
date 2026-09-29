# Redis

Status: local Redis configuration prepared; no clients, caches, business keys, queue
library or workers are implemented. Runtime verification is **NOT RUN** in this phase.

## Local service

Compose uses `redis:7.4-alpine`, published on `127.0.0.1:6379`, attached to the internal
`dependencies` network. `REDIS_PORT` controls the host port; `REDIS_HOST` is a host-client
hint. `REDIS_PASSWORD` is a required, server-only local bootstrap credential.
A shared password is not service isolation: per-service ACLs and TLS remain planned.

`redis_data` stores AOF data. Persistence is retained because future coordination and
job metadata should survive an ordinary local container restart, not just cache use.
AOF uses `appendfsync everysec`; RDB schedules are disabled to avoid two independent
local persistence mechanisms. Around one second of writes can be lost on a crash;
this is not a durable broker or a backup guarantee. See
[Redis persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/).

`maxmemory-policy noeviction` prevents eviction policy from silently deleting future
job keys. TTL expiration remains available; a memory budget, quotas, and separation
of cache/queue workloads must be decided with real workloads. The policy alone does
not limit memory. No production resource limits or delivery guarantees are claimed.

## Future key conventions

- Service-only state: `amani:<service>:<purpose>:<identifier>`.
- Tenant-sensitive state: `amani:<service>:<organizationId>:<purpose>:<identifier>`.
- Permission-sensitive results additionally include bounded user/resource/policy
  version scope as appropriate, plus an explicit TTL and revocation strategy.

Examples are naming conventions only; no keys are created. Use canonical opaque
identifiers and unambiguous escaping for separators. Prefixes are not access control.
Every client must validate organization/permissions before reading or writing and
must not fall back to a default tenant. Exclude raw documents, tokens and credentials
from keys/logs and avoid unconstrained customer content in queue payloads.

## Node/Python constraint

No BullMQ integration is implemented. A future Python Data Engine must not read
BullMQ's internal Redis structures or be assumed compatible with a NestJS worker.
ADR-0006/0024 require an explicit versioned contract: authenticated internal HTTP,
a genuinely interoperable messaging protocol, or another separately selected
mechanism. Job idempotency, retries, expiration and reauthorization are future work.

## Owner commands and expected results

Start the stack only through the owner workflow in [infrastructure](../README.md).
Once Redis is running, this read-only command must return `PONG`:

```bash
docker compose exec -T redis sh -c 'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli ping'
```

The healthcheck requires the same authenticated response; it does not test jobs,
durability or cache isolation. `npm run infra:logs` shows local diagnostics, and
`npm run infra:down` preserves `redis_data`. Do not use FLUSHALL or delete volumes as
a routine verification step. Keep host access restricted; see
[Redis security](https://redis.io/docs/latest/operate/oss_and_stack/management/security/).
