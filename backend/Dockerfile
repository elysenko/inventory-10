FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./
EXPOSE 3000
# migrate deploy is idempotent and advisory-locked, so it is safe across replicas and
# safe alongside the platform's migrate Job. It guarantees the schema is present even
# when no separate Job ran. The seed is NOT chained here: it is platform-owned and runs
# from the migrate Job with COLOSSUS_ACCOUNTS_JSON injected.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
