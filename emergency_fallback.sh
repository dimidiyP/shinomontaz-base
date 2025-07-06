#!/bin/bash

# Emergency fallback script - switches from Docker mode back to supervisor mode
# Use this when Docker deployment fails

echo "🚨 Emergency fallback: Switching back to supervisor mode..."

# Stop all Docker containers
echo "⏹️ Stopping Docker containers..."
docker-compose down || true
docker stop $(docker ps -aq) 2>/dev/null || true
docker rm $(docker ps -aq) 2>/dev/null || true

# Kill any hanging processes
echo "🧹 Cleaning up processes..."
sudo pkill -f "docker-compose" || true
sleep 5

# Make sure ports are free
echo "📡 Freeing up ports..."
sudo fuser -k 80/tcp 2>/dev/null || true
sudo fuser -k 443/tcp 2>/dev/null || true
sudo fuser -k 3000/tcp 2>/dev/null || true
sudo fuser -k 8001/tcp 2>/dev/null || true
sudo fuser -k 27017/tcp 2>/dev/null || true
sleep 3

# Start supervisor services
echo "▶️ Starting supervisor services..."
sudo supervisorctl start mongodb
sleep 5
sudo supervisorctl start backend
sleep 5
sudo supervisorctl start frontend
sleep 10
sudo supervisorctl start nginx

# Check status
echo "📊 Checking service status..."
sudo supervisorctl status

# Run health check
echo "🏥 Running health check..."
/app/health_monitor.sh

echo "✅ Emergency fallback completed!"
echo "📝 System is now running in supervisor mode"
echo "🌐 Site should be accessible at: https://baseshinomontaz.ru/"