#!/bin/sh
# setup-test-services.sh — Install and start PostgreSQL + Redis inline
set -e

apk add --no-cache postgresql postgresql-client redis su-exec >/dev/null 2>&1

# ── PostgreSQL ──
echo ">>> Setting up PostgreSQL..."
mkdir -p /var/lib/postgresql/data /run/postgresql
chown -R postgres:postgres /var/lib/postgresql /run/postgresql

su-exec postgres initdb -D /var/lib/postgresql/data --auth-host=trust --auth-local=trust -q

# Allow TCP connections
echo "host all all 0.0.0.0/0 trust" >> /var/lib/postgresql/data/pg_hba.conf
echo "listen_addresses = '*'" >> /var/lib/postgresql/data/postgresql.conf

su-exec postgres pg_ctl -D /var/lib/postgresql/data -l /tmp/pg.log start -w

# Create database and user
su-exec postgres psql -q <<SQL
CREATE USER stride WITH PASSWORD 'stride' SUPERUSER;
CREATE DATABASE stride OWNER stride;
SQL

echo ">>> PostgreSQL ready on localhost:5432"

# ── Redis ──
echo ">>> Starting Redis..."
redis-server --daemonize yes --bind 0.0.0.0 --protected-mode no --loglevel warning
echo ">>> Redis ready on localhost:6379"
