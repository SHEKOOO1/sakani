FROM node:22-alpine AS builder
RUN apk add --no-cache curl
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx tsc --noEmit && npm run build

FROM node:22-alpine AS runner
RUN apk add --no-cache curl su-exec && \
    addgroup -g 1001 -S appgroup && \
    adduser -S -u 1001 -G appgroup appuser

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV TSX_TELEMETRY=disabled

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/knexfile.ts ./
COPY --from=builder /app/src/backend ./src/backend
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/tsconfig.json ./

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# uploads/ is runtime data (bind-mounted) and is excluded from the build
# context via .dockerignore — create the empty structure instead of baking data.
RUN mkdir -p /app/uploads/documents /app/uploads/radio /app/uploads/broadcasts && \
    chmod +x /usr/local/bin/docker-entrypoint.sh && \
    chown -R appuser:appgroup /app/uploads && \
    chmod -R 755 /app && \
    chmod -R 775 /app/uploads

# P1: entrypoint starts as root only to chown the bind-mounted ./uploads and
# ./logs (created root:root on a fresh host), then drops to appuser via su-exec.
ENTRYPOINT ["docker-entrypoint.sh"]

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# tsx handles .ts imports at runtime — needed for server.ts and all backend src
CMD ["npx", "tsx", "server.ts"]
