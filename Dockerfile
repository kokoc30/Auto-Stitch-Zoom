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

# Hosted browser-only deployment profile. When set to "true" the Vite build
# bakes in VITE_HOSTED_BROWSER_ONLY=true so the client disables server mode,
# hides server/auto UI, and routes all exports through BrowserProcessor.
ARG HOSTED_BROWSER_ONLY=false
ENV VITE_HOSTED_BROWSER_ONLY=${HOSTED_BROWSER_ONLY}

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

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server/dist/server.js"]
