# Redis

Redis is the planned backend cache and asynchronous work dependency. The local `redis:7.4-alpine` container enables append-only persistence in the `redis_data` volume and requires a password. No queue library, workers, cache namespaces or Redis clients are integrated yet.

## Environment and development

Configure required `REDIS_PASSWORD` and optional `REDIS_PORT` (default `6379`) in the root `.env`. Redis is reachable at `127.0.0.1:6379` from host processes; future Compose clients use `redis:6379`. Future client URLs must encode any reserved characters in the password. These settings do not configure application clients automatically.

Run from the repository root after preparing `.env`:

```bash
docker compose up -d --wait redis
docker compose logs --tail=100 redis
docker compose exec redis sh -c 'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli ping'
```

The last command must print `PONG`; the Compose healthcheck also requires that exact response. This verifies basic authenticated responsiveness, not queue processing or data durability. There are no automated cache or queue tests yet, and runtime validation remains pending.

Redis is for trusted backend callers. The [Redis security documentation](https://redis.io/docs/latest/operate/oss_and_stack/management/security/) describes password authentication and the need to restrict network access. This local configuration binds the host port to loopback and uses a shared development password; fine-grained ACLs and TLS are not configured. Keep production credentials and customer data out of this local instance.

Future cache keys and jobs must carry validated organization and permission context. Workers must re-check access before processing data, and cached responses must not cross tenant or user permission boundaries. See [infrastructure overview](../README.md) for persistence and lifecycle commands.
