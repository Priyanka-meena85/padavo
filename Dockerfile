# PADAVO PRODUCTION DOCKERFILE
FROM node:24-alpine

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3001

# Copy project files
COPY package.json ./
COPY server.js ./
COPY public/ ./public/

# Create uploads directory and volumes
RUN mkdir -p uploads
VOLUME ["/app/uploads", "/app/data"]

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
