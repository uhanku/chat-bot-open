FROM node:24-alpine AS web-deps
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci

FROM node:24-alpine AS web-build
WORKDIR /app/web
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=web-deps /app/web/node_modules ./node_modules
COPY web ./
RUN npm run build
RUN npm prune --omit=dev

FROM node:24-alpine AS runner
WORKDIR /app/web
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY web/package.json web/package-lock.json ./
COPY mcp/package.json mcp/package-lock.json mcp/server.ts ../mcp/
RUN npm ci --omit=dev
RUN cd ../mcp && npm ci --omit=dev
COPY --from=web-build /app/web/.next ./.next
COPY --from=web-build /app/web/public ./public
COPY --from=web-build /app/web/next.config.ts ./next.config.ts
COPY --from=web-build /app/web/docs ./docs

EXPOSE 3000
CMD ["npm", "run", "start"]
