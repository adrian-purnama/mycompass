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
    
    
    
    # ---------- 3) Run the App (DEBIAN RUNNER) ----------
    FROM node:20 AS runner
    WORKDIR /app
    
    # --- TIMEZONE ---
    ENV TZ=Asia/Jakarta
    RUN apt-get update && apt-get install -y tzdata cron curl && rm -rf /var/lib/apt/lists/* && \
        ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
    
    # --- FIX NODE PATH FOR CRON ---
    RUN ln -s /usr/local/bin/node /usr/bin/node
    
    ENV NODE_ENV=production
    ENV PORT=3000
    
    # --- COPY BUILT APP ---
    COPY --from=builder /app ./
    
    # --- LOG FILE ---
    RUN mkdir -p /var/log && touch /var/log/backup-cron.log && chmod 666 /var/log/backup-cron.log
    
    # --- EXECUTE PERMISSIONS ---
    RUN chmod +x ./src/scripts/backup-cron.js
    
    # --- CRON WRAPPER SCRIPT ---
    RUN echo '#!/bin/sh\n\
    cd /app\n\
    /usr/bin/node src/scripts/backup-cron.js "$@"' > /app/run-backup-cron.sh && \
        chmod +x /app/run-backup-cron.sh
    
    # --- CRON CONFIG (entrypoint will override this on boot) ---
    RUN echo "SHELL=/bin/sh" > /etc/cron.d/backup-cron && \
        echo "PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin" >> /etc/cron.d/backup-cron && \
        echo "* * * * * root /app/run-backup-cron.sh >> /var/log/backup-cron.log 2>&1" >> /etc/cron.d/backup-cron && \
        chmod 0644 /etc/cron.d/backup-cron
    
    # --- ENTRYPOINT ---
    COPY docker-entrypoint.sh /docker-entrypoint.sh
    RUN chmod +x /docker-entrypoint.sh
    
    EXPOSE 3000
    
    CMD ["/docker-entrypoint.sh"]
    