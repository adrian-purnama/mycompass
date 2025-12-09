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

    RUN apt-get update && apt-get install -y cron curl && rm -rf /var/lib/apt/lists/*
    
    ENV NODE_ENV=production
    ENV PORT=3000
    
    COPY --from=builder /app ./
    
    RUN chmod +x ./src/scripts/backup-cron.js
    RUN echo "* * * * * cd /app && node src/scripts/backup-cron.js >> /var/log/backup-cron.log 2>&1" > /etc/crontab
    RUN touch /var/log/backup-cron.log && chmod 666 /var/log/backup-cron.log
    
    COPY docker-entrypoint.sh /docker-entrypoint.sh
    RUN chmod +x /docker-entrypoint.sh
    
    EXPOSE 3000
    CMD ["/docker-entrypoint.sh"]
    
    