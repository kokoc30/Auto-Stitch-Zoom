FROM node:20-bookworm-slim AS deps

WORKDIR /app

COPY package.json ./
COPY client/package.json client/package-lock.json ./client/
COPY server/package.json server/package-lock.json ./server/

RUN npm ci --prefix client \
  && npm ci --prefix server

FROM deps AS build

WORKDIR /app

COPY . .

RUN npm run build

FROM node:20-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

COPY server/package.json server/package-lock.json ./server/

RUN npm ci --omit=dev --prefix server \
  && npm cache clean --force

COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist

RUN mkdir -p /app/server/tmp/uploads \
  && chown -R node:node /app

USER node

EXPOSE 3001

CMD ["node", "server/dist/server.js"]
