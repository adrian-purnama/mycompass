#!/bin/sh

# Start cron daemon in background
crond -f -l 2 &

# Start Next.js application
exec npm start


