#!/bin/sh
# setup-test-services.sh — Install and start PostgreSQL + Redis inline
# Verbose mode for debugging CI failures
set -ex

echo ">>> Installing packages..."
apk add --no-cache postgresql postgresql-client redis su-exec || {
  echo ">>> apk add returned non-zero (post-install chown warnings) — continuing..."
}

echo ">>> System info:"
id
cat /proc/1/status | grep -i cap || true

# ── PostgreSQL ──
echo ">>> Setting up PostgreSQL..."
mkdir -p /var/lib/postgresql/data /run/postgresql

echo ">>> Testing chown..."
if chown -R postgres:postgres /var/lib/postgresql /run/postgresql; then
  echo ">>> chown succeeded, using su-exec approach"

  su-exec postgres initdb -D /var/lib/postgresql/data --auth-host=trust --auth-local=trust -q
  echo "host all all 0.0.0.0/0 trust" >> /var/lib/postgresql/data/pg_hba.conf
  echo "listen_addresses = '*'" >> /var/lib/postgresql/data/postgresql.conf
  su-exec postgres pg_ctl -D /var/lib/postgresql/data -l /tmp/pg.log start -w

  su-exec postgres psql -q <<SQL
CREATE USER stride WITH PASSWORD 'stride' SUPERUSER;
CREATE DATABASE stride OWNER stride;
SQL

else
  echo ">>> chown failed — capabilities dropped. Using chmod 777 + adduser workaround"

  # postgres refuses to run as root, but we can create a user and use chmod
  chmod -R 777 /var/lib/postgresql /run/postgresql

  # Try running initdb as postgres user (might work even without SETUID if user exists)
  su-exec postgres initdb -D /var/lib/postgresql/data --auth-host=trust --auth-local=trust -q 2>&1 || {
    echo ">>> su-exec initdb failed, trying adduser approach..."
    # adduser doesn't need capabilities, it just writes to /etc/passwd
    adduser -D -h /var/lib/postgresql pguser 2>/dev/null || true
    chmod -R 777 /var/lib/postgresql /run/postgresql
    su -s /bin/sh pguser -c "initdb -D /var/lib/postgresql/data --auth-host=trust --auth-local=trust -q" 2>&1 || {
      echo ">>> ALL initdb approaches FAILED"
      exit 1
    }
  }

  echo "host all all 0.0.0.0/0 trust" >> /var/lib/postgresql/data/pg_hba.conf
  echo "listen_addresses = '*'" >> /var/lib/postgresql/data/postgresql.conf

  su-exec postgres pg_ctl -D /var/lib/postgresql/data -l /tmp/pg.log start -w 2>&1 || \
    su -s /bin/sh pguser -c "pg_ctl -D /var/lib/postgresql/data -l /tmp/pg.log start -w" 2>&1 || {
      echo ">>> pg_ctl start FAILED"
      cat /tmp/pg.log 2>/dev/null || true
      exit 1
    }

  su-exec postgres psql -q -c "CREATE USER stride WITH PASSWORD 'stride' SUPERUSER;" 2>/dev/null || \
    psql -h localhost -U postgres -q -c "CREATE USER stride WITH PASSWORD 'stride' SUPERUSER;" 2>/dev/null || true
  su-exec postgres psql -q -c "CREATE DATABASE stride OWNER stride;" 2>/dev/null || \
    psql -h localhost -U postgres -q -c "CREATE DATABASE stride OWNER stride;" 2>/dev/null || true
fi

echo ">>> PostgreSQL ready on localhost:5432"

# ── Redis ──
echo ">>> Starting Redis..."
redis-server --daemonize yes --bind 0.0.0.0 --protected-mode no --loglevel warning
echo ">>> Redis ready on localhost:6379"

echo ">>> All test services started."
