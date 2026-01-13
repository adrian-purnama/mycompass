#!/bin/sh
# Helper script to start supervisord if it's not running
# This can be run inside the container to fix the issue

echo "=== Checking current processes ==="
ps aux | grep -E "supervisord|cron|next-server" | grep -v grep

echo ""
echo "=== Starting supervisord ==="

# Check if supervisord is already running
if pgrep -x supervisord > /dev/null; then
    echo "Supervisord is already running (PID: $(pgrep -x supervisord))"
    supervisorctl status
    exit 0
fi

# Ensure log directory exists
mkdir -p /var/log
touch /var/log/supervisord.log
touch /var/log/backup-cron.log
touch /var/log/cron.out.log
touch /var/log/cron.err.log
touch /var/log/nextjs.out.log
touch /var/log/nextjs.err.log

# Start supervisord
echo "Starting supervisord..."
/usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf

sleep 2

# Check status
if pgrep -x supervisord > /dev/null; then
    echo "✓ Supervisord started successfully"
    echo ""
    echo "=== Service Status ==="
    supervisorctl status
    echo ""
    echo "=== Cron logs (last 10 lines) ==="
    tail -n 10 /var/log/backup-cron.log 2>/dev/null || echo "No cron logs yet"
else
    echo "✗ Failed to start supervisord"
    echo "Check /var/log/supervisord.log for errors"
    exit 1
fi

