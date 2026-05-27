# =============================================================================
# OriCMS API - Production Dockerfile
# =============================================================================

FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./
COPY packages/api/package*.json ./packages/api/
COPY packages/shared ./packages/shared

# Install dependencies
RUN npm ci --workspace=@ori/api --include-workspace-root

# Copy source code
COPY packages/api ./packages/api

# Build the application
RUN cd packages/api && npm run build

# =============================================================================
# Production Stage
# =============================================================================
FROM node:20-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache git openssh-client

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/api/package*.json ./packages/api/

# Install production dependencies only
RUN npm ci --workspace=@ori/api --include-workspace-root --omit=dev && \
    npm cache clean --force

# Copy built application
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/api/prisma ./packages/api/prisma
COPY --from=builder /app/packages/shared ./packages/shared

# Generate Prisma Client
RUN cd packages/api && npx prisma generate

# Create uploads directory
RUN mkdir -p /app/uploads && chown -R nodejs:nodejs /app/uploads

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "packages/api/dist/index.js"]
