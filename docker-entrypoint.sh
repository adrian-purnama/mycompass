#!/bin/sh

# Print environment info for debugging
echo "Starting application..."
echo "NODE_ENV: ${NODE_ENV}"
echo "PORT: ${PORT}"

# Ensure log file exists and is writable
touch /var/log/backup-cron.log
chmod 666 /var/log/backup-cron.log

# Update the cron job with current environment variables
echo "Updating cron job with environment variables..."

cat > /etc/cron.d/backup-cron << EOF
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# Environment variables available to all cron commands
NODE_ENV=${NODE_ENV:-production}
CRON_API_KEY=${CRON_API_KEY}
API_URL=${API_URL}
NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

# -------------------------------
# Backup runs every minute
# -------------------------------
* * * * * root cd /app && NODE_ENV=${NODE_ENV:-production} CRON_API_KEY=${CRON_API_KEY} API_URL=${API_URL} NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} /usr/bin/node src/scripts/backup-cron.js >> /var/log/backup-cron.log 2>&1

# -------------------------------
# Log rotation: Clear log every midnight
# -------------------------------
0 0 * * * root truncate -s 0 /var/log/backup-cron.log

EOF

chmod 0644 /etc/cron.d/backup-cron

# Verify cron configuration
echo "Cron jobs configured:"
cat /etc/cron.d/backup-cron
echo ""
echo "Cron will run every minute and log to: /var/log/backup-cron.log"

# Start supervisord which will manage both cron and Next.js
echo "Starting supervisord to manage cron and Next.js..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
