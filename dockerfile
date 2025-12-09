# ---------- 1) Install Dependencies (DEBIAN) ----------
    FROM node:20 AS deps
    WORKDIR /app
    
    COPY package.json package-lock.json* ./
    RUN npm install --legacy-peer-deps
    
    # ---------- 2) Build Next.js App (DEBIAN) ----------
    FROM node:20 AS builder
    WORKDIR /app
    
    COPY --from=deps /app/node_modules ./node_modules
    COPY . .
    
    ENV NODE_ENV=production
    RUN npm run build
    
    # ---------- 3) Run the App (ALPINE or DEBIAN) ----------
    FROM node:20-alpine AS runner
    # If Alpine still gives issues → switch to: FROM node:20
    
    WORKDIR /app
    
    # Install cron + curl
    RUN apk add --no-cache dcron curl
    
    ENV NODE_ENV=production
    ENV PORT=3000
    
    COPY --from=builder /app ./
    
    # Make backup-cron executable
    RUN chmod +x ./src/scripts/backup-cron.js
    
    # Set up cron job
    RUN echo "* * * * * cd /app && node src/scripts/backup-cron.js >> /var/log/backup-cron.log 2>&1" > /etc/crontabs/root
    
    RUN touch /var/log/backup-cron.log && chmod 666 /var/log/backup-cron.log
    
    COPY docker-entrypoint.sh /docker-entrypoint.sh
    RUN chmod +x /docker-entrypoint.sh
    
    EXPOSE 3000
    
    CMD ["/docker-entrypoint.sh"]
    