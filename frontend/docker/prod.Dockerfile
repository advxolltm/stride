FROM node:24-slim AS builder

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096"
ARG VITE_API_BASE_PATH=/api/v1
ENV VITE_API_BASE_PATH=${VITE_API_BASE_PATH}
ARG APPLICATION_MODE=closed_network
ENV APPLICATION_MODE=${APPLICATION_MODE}
ARG PASSWORD_MIN_LENGTH=8
ENV PASSWORD_MIN_LENGTH=${PASSWORD_MIN_LENGTH}
ARG PASSWORD_REQUIRE_SPECIAL_CHAR=true
ENV PASSWORD_REQUIRE_SPECIAL_CHAR=${PASSWORD_REQUIRE_SPECIAL_CHAR}
ARG PASSWORD_REQUIRE_NUM=true
ENV PASSWORD_REQUIRE_NUM=${PASSWORD_REQUIRE_NUM}
ARG USERNAME_MIN_LENGTH=3
ENV USERNAME_MIN_LENGTH=${USERNAME_MIN_LENGTH}
ARG USERNAME_MAX_LENGTH=255
ENV USERNAME_MAX_LENGTH=${USERNAME_MAX_LENGTH}

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY index.html ./
COPY tailwind.config.js ./
COPY tsconfig.app.json ./
COPY tsconfig.json ./
COPY tsconfig.node.json ./
COPY vite.config.ts ./
COPY src ./src
COPY public ./public

RUN npm run build

FROM nginx:1.27-alpine AS production

COPY docker/prod.nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 3000
