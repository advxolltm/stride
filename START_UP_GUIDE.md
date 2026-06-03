# STRIDE Start up

## CLI

The root `stride` script wraps common setup and operation tasks:

Usage:
./stride start Interactive production setup and start
./stride devrun Start the development Docker Compose stack
./stride down [prod|dev] Stop a stack, defaults to prod
./stride restart [prod|dev] Restart containers, defaults to prod
./stride certificate Configure production TLS certificates
./stride test Run frontend and backend test cycle

`./stride start` performs interactive production setup. It creates or updates
`.env`, asks for deployment mode, configures certificates, starts
`compose.prod.yml`, and creates the first superuser only for public internet
deployments. Public internet deployment sets `APPLICATION_MODE=closed_auth`;
VPN/corporate deployment sets `APPLICATION_MODE=closed_network`.

`./stride certificate` repeats only the certificate step. Automatic certificates use
host-level `certbot`, copy the issued certificate into
`./nginx/production/certs`, set `SITE_DOMAIN`, and install a renewal cron entry.
Manual certificates ask for the domain, fullchain path, and private key path.
Choosing no certificate clears `SITE_DOMAIN` so nginx listens without TLS
certificate statements.

## Start

```bash
docker compose -f compose.dev.yml up -d --build
docker compose -f compose.dev.yml ps
```

Open:

- Frontend via nginx: http://localhost:8080
- API health from host: `curl -s http://localhost:8080/api/v1/health`

## Enter Containers

```bash
docker compose -f compose.dev.yml exec backserver sh
docker compose -f compose.dev.yml exec frontserver sh
docker compose -f compose.dev.yml exec web sh
docker compose -f compose.dev.yml exec db sh
docker compose -f compose.dev.yml exec redis sh
```

## Requests Inside Docker Network

Use service names as hostnames (`backserver`, `frontserver`, `web`, `db`, `redis`).

```bash
# backserver -> backserver (direct API)
docker compose -f compose.dev.yml exec -T backserver wget -qO- http://localhost:8000/api/v1/health

# backserver -> web (through nginx)
docker compose -f compose.dev.yml exec -T backserver wget -qO- http://web:8080/api/v1/health

# db check
docker compose -f compose.dev.yml exec -T db pg_isready -U stride -d stride

# redis check
docker compose -f compose.dev.yml exec -T redis redis-cli ping
```

## Stop

```bash
docker compose -f compose.dev.yml down
docker compose -f compose.dev.yml down -v
```

## Production

Production exposes only nginx on ports 80 and 443. PostgreSQL, Redis, backend,
and frontend stay on the internal Docker network.

```bash
docker compose -f compose.prod.yml up -d --build
docker compose -f compose.prod.yml ps
```

Persistent production data is written under `./data`:

- `./data/db:/var/lib/postgresql/data/`
- `./data/redis:/data`
- `./data/media:/app/media` for backend avatar uploads

If `SITE_DOMAIN` is set, nginx redirects HTTP to HTTPS and expects:

- `./nginx/production/certs/fullchain.pem`
- `./nginx/production/certs/privkey.pem`

If `SITE_DOMAIN` is empty, nginx listens on ports 80 and 443 without domain or
TLS certificate statements.
