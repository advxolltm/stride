# STRIDE Start up

## Start

```bash
docker compose -f compose.dev.yml up -d --build
docker compose -f compose.dev.yml ps
```

Open:

- Frontend via nginx: http://localhost
- API health from host: `curl -s http://localhost/api/v1/health`

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
