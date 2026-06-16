#!/bin/sh
set -eu

API_BASE_PATH="${API_BASE_PATH:-/api/v1}"
case "$API_BASE_PATH" in
    /*) ;;
    *) API_BASE_PATH="/$API_BASE_PATH" ;;
esac
API_BASE_PATH="${API_BASE_PATH%/}"
if [ -z "$API_BASE_PATH" ]; then
    API_BASE_PATH="/api/v1"
fi
WS_BASE_PATH="${API_BASE_PATH}/ws/"

SITE_DOMAIN="${SITE_DOMAIN:-}"
CONF_PATH="/etc/nginx/conf.d/default.conf"

write_upstreams() {
    cat > "$CONF_PATH" <<'EOF_CONF'
upstream backserver {
    server backserver:8000;
}

upstream frontserver {
    server frontserver:3000;
}
EOF_CONF
}

write_app_locations() {
    cat >> "$CONF_PATH" <<EOF_CONF
    proxy_cache off;
    proxy_set_header Host \$host;
    proxy_set_header x-ip-address \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;

    location ^~ ${WS_BASE_PATH} {
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
        proxy_cache_bypass \$http_upgrade;
        proxy_buffering off;
        proxy_read_timeout 1h;
        proxy_send_timeout 1h;
        proxy_pass http://backserver;
    }

    location /api/ {
        proxy_pass http://backserver;
    }

    location /media/ {
        alias /media/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location / {
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
        proxy_cache_bypass \$http_upgrade;
        proxy_pass http://frontserver;
    }
EOF_CONF
}

write_upstreams

if [ -n "$SITE_DOMAIN" ]; then
    cat >> "$CONF_PATH" <<EOF_CONF

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${SITE_DOMAIN};

    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    http2 on;
    server_name ${SITE_DOMAIN};

    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

EOF_CONF
    write_app_locations
    cat >> "$CONF_PATH" <<'EOF_CONF'
}
EOF_CONF
else
    cat >> "$CONF_PATH" <<'EOF_CONF'

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    listen 443 default_server;
    listen [::]:443 default_server;
    server_name _;

EOF_CONF
    write_app_locations
    cat >> "$CONF_PATH" <<'EOF_CONF'
}
EOF_CONF
fi
