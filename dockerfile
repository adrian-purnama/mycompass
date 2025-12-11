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
# ---------- 3) Run the App (DEBIAN RUNNER) ----------
    FROM node:20 AS runner
    WORKDIR /app
    
    # Set timezone to Asia/Jakarta
ENV TZ=Asia/Jakarta
RUN apt-get update && apt-get install -y tzdata >/dev/null 2>&1
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

    RUN apt-get update && apt-get install -y cron curl && rm -rf /var/lib/apt/lists/* && \
        which cron && echo "Cron installed successfully" || (echo "Cron installation failed" && exit 1)
    
    ENV NODE_ENV=production
    ENV PORT=3000
    
    COPY --from=builder /app ./
    
    # Create cron directory and log file
    RUN mkdir -p /var/log && touch /var/log/backup-cron.log && chmod 666 /var/log/backup-cron.log
    
    # Make backup script executable
    RUN chmod +x ./src/scripts/backup-cron.js
    
    # Create a script wrapper that sources environment and runs the cron job
    RUN echo '#!/bin/sh\n\
cd /app\n\
. /app/.env 2>/dev/null || true\n\
export NODE_ENV=${NODE_ENV:-production}\n\
export CRON_API_KEY=${CRON_API_KEY}\n\
export API_URL=${API_URL}\n\
export NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}\n\
/usr/bin/node src/scripts/backup-cron.js "$@"' > /app/run-backup-cron.sh && \
        chmod +x /app/run-backup-cron.sh
    
    # Create crontab file with proper environment setup
    # Note: Environment variables will be set at runtime via docker-entrypoint.sh
    RUN echo "SHELL=/bin/sh" > /etc/cron.d/backup-cron && \
        echo "PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin:/usr/local/bin/node" >> /etc/cron.d/backup-cron && \
        echo "" >> /etc/cron.d/backup-cron && \
        echo "* * * * * root /app/run-backup-cron.sh >> /var/log/backup-cron.log 2>&1" >> /etc/cron.d/backup-cron && \
        chmod 0644 /etc/cron.d/backup-cron
    
    COPY docker-entrypoint.sh /docker-entrypoint.sh
    RUN chmod +x /docker-entrypoint.sh
    
    EXPOSE 3000
    CMD ["/docker-entrypoint.sh"]
    
    