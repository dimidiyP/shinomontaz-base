#!/bin/bash

echo "🔧 Экстренная очистка Docker портов..."

echo "1. Останавливаем все контейнеры..."
docker stop $(docker ps -q) 2>/dev/null || echo "Нет запущенных контейнеров"

echo "2. Удаляем все остановленные контейнеры..."
docker rm $(docker ps -aq) 2>/dev/null || echo "Нет контейнеров для удаления"

echo "3. Останавливаем контейнеры использующие порт 80..."
docker ps -q --filter "publish=80" | xargs -r docker stop

echo "4. Останавливаем контейнеры использующие порт 443..."
docker ps -q --filter "publish=443" | xargs -r docker stop

echo "5. Принудительная очистка системы Docker..."
docker system prune -af

echo "6. Проверяем занятые порты..."
echo "Порт 80:"
netstat -tlnp | grep :80 || echo "Порт 80 свободен"
echo "Порт 443:"
netstat -tlnp | grep :443 || echo "Порт 443 свободен"

echo "✅ Очистка завершена! Теперь можно запускать docker-compose up -d"