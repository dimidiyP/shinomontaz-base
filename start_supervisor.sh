#!/bin/bash

# Simple script to start supervisor services for fallback
# This script is called from GitHub Actions workflow during emergency fallback

echo "▶️ Starting supervisor services for emergency fallback..."

# Stop any Docker containers first
docker-compose down 2>/dev/null || true
docker stop $(docker ps -aq) 2>/dev/null || true

# Free up ports
fuser -k 80/tcp 2>/dev/null || true
fuser -k 443/tcp 2>/dev/null || true
fuser -k 3000/tcp 2>/dev/null || true
fuser -k 8001/tcp 2>/dev/null || true
fuser -k 27017/tcp 2>/dev/null || true

sleep 3

# Start supervisor services in correct order
echo "Starting MongoDB..."
/usr/bin/supervisorctl start mongodb
sleep 5

echo "Starting Backend..."
/usr/bin/supervisorctl start backend
sleep 5

echo "Starting Frontend..."
/usr/bin/supervisorctl start frontend
sleep 10

echo "Starting Nginx..."
/usr/bin/supervisorctl start nginx
sleep 5

# Check status
echo "Checking service status..."
/usr/bin/supervisorctl status

echo "✅ Supervisor services started successfully"

exit 0