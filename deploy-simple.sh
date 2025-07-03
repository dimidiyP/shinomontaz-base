#!/bin/bash

echo "🚀 Starting simple deployment without frontend tests..."

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
sleep 45

# Check if backend is working
echo "🔍 Testing backend health..."
curl -f https://baseshinomontaz.ru/api/health || curl -f http://baseshinomontaz.ru/ || {
  echo "❌ Services not responding, check logs:"
  docker-compose logs --tail=20
  exit 1
}

echo "✅ Simple deployment completed successfully!"
echo "🌐 Site should be available at: https://baseshinomontaz.ru"