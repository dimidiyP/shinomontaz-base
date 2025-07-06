#!/bin/bash

# Simple script to stop supervisor services for deployment
# This script is called from GitHub Actions workflow

echo "⏹️ Stopping supervisor services for deployment..."

# Stop supervisor services
/usr/bin/supervisorctl stop all 2>/dev/null || true

# Kill any remaining processes that might block ports
pkill -f mongod 2>/dev/null || true
pkill -f uvicorn 2>/dev/null || true
pkill -f "yarn start" 2>/dev/null || true
pkill -f nginx 2>/dev/null || true

# Wait a bit for processes to stop
sleep 5

# Double check and force kill if needed
fuser -k 80/tcp 2>/dev/null || true
fuser -k 443/tcp 2>/dev/null || true
fuser -k 3000/tcp 2>/dev/null || true
fuser -k 8001/tcp 2>/dev/null || true
fuser -k 27017/tcp 2>/dev/null || true

echo "✅ Supervisor services stopped and ports freed"

exit 0