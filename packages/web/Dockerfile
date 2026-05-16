# =============================================================================
# OriCMS Web - Production Dockerfile (Multi-stage build)
# =============================================================================

FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./
COPY packages/web/package*.json ./packages/web/
COPY packages/shared ./packages/shared

# Install dependencies
RUN npm ci --workspace=@ori/web --include-workspace-root

# Copy source code
COPY packages/web ./packages/web

# Build the application
RUN cd packages/web && npm run build

# =============================================================================
# Production Stage (Nginx)
# =============================================================================
FROM nginx:alpine AS production

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache curl

# Copy custom nginx config
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built application
COPY --from=builder /app/packages/web/dist /usr/share/nginx/html

# Create nginx user if not exists
RUN adduser -D -u 1001 nginx-user || true

# Set proper permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d

# Switch to non-root user
USER nginx

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
