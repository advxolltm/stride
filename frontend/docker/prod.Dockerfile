# Stage 1: Build
FROM node:24-slim AS builder

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096"

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm install --include=dev

COPY index.html .
COPY tailwind.config.js .
COPY postcss.config.js .
COPY tsconfig.app.json .
COPY tsconfig.json .
COPY tsconfig.node.json .
COPY vite.config.ts .
COPY eslint.config.js .
COPY prettier.config.cjs .
COPY plugins/ ./plugins/

COPY src/ ./src/
COPY public/ ./public/

RUN npm run build

FROM node:24-alpine AS production

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
