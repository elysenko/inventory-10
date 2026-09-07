# syntax=docker/dockerfile:1
# Combined nginx + supervisord container (Angular 19 SPA + NestJS 11 API).
# Built for linux/amd64: buildkitd-amd64 is the only worker offering amd64 and the
# prebaked colossus-base-angular:v2 base image is an amd64 image.

# ---------- frontend builder ----------
FROM ubuntu:30500/colossus-base-angular:v2 AS frontend-builder
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
# Reuse the prebaked node_modules when the dep SET matches the template, else install.
RUN --mount=type=cache,target=/root/.npm \
    if node -e "const a=require('./package.json'),b=require('/opt/colossus/angular-warmup/package.json');const k=o=>JSON.stringify([o.dependencies||{},o.devDependencies||{}]);process.exit(k(a)===k(b)?0:1)"; then \
      echo 'angular-warmup seed HIT: reusing prebaked node_modules'; \
      cp -a /opt/colossus/angular-warmup/node_modules ./node_modules; \
    else \
      echo 'angular-warmup seed MISS: dep set diverged — npm install fallback'; \
      npm install --no-audit --no-fund --loglevel=error; \
    fi
COPY frontend/ ./
# base-href '/' — the app is served at the root of its own preview subdomain.
RUN npx ng build --base-href / --configuration production \
    && test -f /app/dist/frontend/browser/index.html \
    || (echo 'ERROR: Angular build produced no dist/frontend/browser/index.html' && exit 1)

# ---------- backend builder ----------
FROM node:22-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package.json ./
# No package-lock.json in backend/ => npm ci is impossible. --legacy-peer-deps is
# required because nestjs-trpc@2 declares a NestJS 10 peer range but runs on 11.
RUN --mount=type=cache,target=/root/.npm \
    npm install --legacy-peer-deps --no-audit --no-fund
COPY backend/ ./
RUN npx prisma generate
RUN npm run build \
    && test -n "$(find /app/backend/dist -name main.js | head -1)" \
    || (echo 'ERROR: no main.js in dist — check tsconfig rootDir' && exit 1)

# ---------- runtime ----------
FROM node:22-alpine AS runtime
RUN apk add --no-cache nginx supervisor
WORKDIR /app

COPY --from=frontend-builder /app/dist/frontend/browser /usr/share/nginx/html
COPY --from=backend-builder /app/backend/dist         /app/backend/dist
COPY --from=backend-builder /app/backend/node_modules /app/backend/node_modules
COPY --from=backend-builder /app/backend/prisma       /app/backend/prisma
COPY --from=backend-builder /app/backend/package.json /app/backend/package.json

COPY nginx.conf      /etc/nginx/http.d/default.conf
COPY supervisord.conf /etc/supervisord.conf

RUN mkdir -p /run/nginx
EXPOSE 80
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
