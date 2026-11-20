# PADAVO PRODUCTION DOCKERFILE
FROM node:24-alpine

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=5500

# Copy project files
COPY package.json ./
COPY *.js ./
COPY public/ ./public/
COPY database.sqlite* ./

# Create uploads directory and volumes
RUN mkdir -p uploads
VOLUME ["/app/uploads", "/app/data"]

EXPOSE 5500

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:5500/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
