#!/bin/sh

# Print environment info for debugging
echo "Starting application..."
echo "NODE_ENV: ${NODE_ENV}"
echo "PORT: ${PORT}"

# Ensure log file exists and is writable
touch /var/log/backup-cron.log
chmod 666 /var/log/backup-cron.log

# Update the cron job with current environment variables
# This ensures environment variables are available to the cron job
echo "Updating cron job with environment variables..."
cat > /etc/cron.d/backup-cron << EOF
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
NODE_ENV=${NODE_ENV:-production}
CRON_API_KEY=${CRON_API_KEY}
API_URL=${API_URL}
NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

* * * * * root cd /app && NODE_ENV=${NODE_ENV:-production} CRON_API_KEY=${CRON_API_KEY} API_URL=${API_URL} NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} /usr/bin/node src/scripts/backup-cron.js >> /var/log/backup-cron.log 2>&1
EOF

chmod 0644 /etc/cron.d/backup-cron

# Start cron daemon (Debian uses 'cron', not 'crond')
echo "Starting cron daemon..."
cron &

# Wait a moment for cron to start
sleep 2

# Verify cron is running
if pgrep -x cron > /dev/null; then
    echo "Cron daemon started successfully"
    echo "Cron jobs configured:"
    cat /etc/cron.d/backup-cron
else
    echo "WARNING: Cron daemon failed to start"
    # Debug: Check if cron is installed
    which cron || echo "cron command not found in PATH"
    ls -la /usr/sbin/cron || echo "/usr/sbin/cron not found"
fi

# Start Next.js application
echo "Starting Next.js application..."
exec npm start


