#!/bin/bash

echo "🚀 Starting deployment..."

# Stop supervisor services to free up ports
echo "⏹️ Stopping supervisor services..."
sudo supervisorctl stop all || true

# Kill any remaining processes that might block ports
echo "🧹 Cleaning up processes..."
sudo pkill -f mongod || true
sudo pkill -f uvicorn || true
sudo pkill -f "yarn start" || true
sudo pkill -f nginx || true
sleep 5

# Stop all services
echo "⏹️ Stopping containers..."
docker-compose down

# Remove old containers and images
echo "🧹 Cleaning up old containers..."
docker-compose rm -f
docker system prune -f

# Rebuild all services
echo "🏗️ Building services..."
docker-compose build --no-cache

# Start all services  
echo "▶️ Starting services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 30

# Check if services are running
echo "📊 Checking service status..."
docker-compose ps

# Test if site is accessible
echo "🌐 Testing site accessibility..."
curl -I http://localhost/ || echo "Site not accessible on HTTP"
curl -I https://baseshinomontaz.ru/ || echo "Site not accessible on HTTPS"

echo "✅ Deployment completed!"