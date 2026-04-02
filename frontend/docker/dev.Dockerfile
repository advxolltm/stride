FROM node:24-slim

ENV NODE_ENV=development
ENV NODE_OPTIONS="--max-old-space-size=4096"

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html ./
COPY vite.config.ts ./
COPY tailwind.config.js ./
COPY tsconfig.app.json ./
COPY tsconfig.json ./
COPY tsconfig.node.json ./
COPY public ./public
COPY src ./src

EXPOSE 3000

CMD ["sh", "-c", "npm ci && npm run dev -- --host 0.0.0.0 --port 3000"]