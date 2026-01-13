#!/bin/sh

# Print environment info for debugging
echo "=========================================="
echo "Starting application via supervisord..."
echo "NODE_ENV: ${NODE_ENV}"
echo "PORT: ${PORT}"
echo "=========================================="

# Kill any existing Next.js processes that might be running
# (in case container was started differently)
pkill -f "next-server" 2>/dev/null || true
pkill -f "npm start" 2>/dev/null || true
sleep 1

# Ensure log directory exists and is writable
mkdir -p /var/log
touch /var/log/backup-cron.log
touch /var/log/supervisord.log
touch /var/log/cron.out.log
touch /var/log/cron.err.log
touch /var/log/nextjs.out.log
touch /var/log/nextjs.err.log
chmod 666 /var/log/backup-cron.log
chmod 666 /var/log/*.log 2>/dev/null || true

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
echo "=========================================="
echo "Starting supervisord to manage cron and Next.js..."
echo "=========================================="

# Ensure supervisord config exists
if [ ! -f /etc/supervisor/conf.d/supervisord.conf ]; then
    echo "ERROR: Supervisord config not found at /etc/supervisor/conf.d/supervisord.conf"
    exit 1
fi

# Verify supervisord is installed
if [ ! -f /usr/bin/supervisord ]; then
    echo "ERROR: Supervisord not found at /usr/bin/supervisord"
    exit 1
fi

# Verify supervisor config syntax
if ! /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf -t; then
    echo "ERROR: Supervisord config syntax error"
    exit 1
fi

echo "Supervisord configuration is valid"
echo "Starting supervisord in foreground mode..."
echo ""

# Start supervisord in foreground mode (this becomes PID 1)
# This ensures supervisord manages both cron and Next.js
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf -n
