#!/bin/bash

echo "🔧 Исправление проблем с Docker сборкой frontend..."

cd /app/frontend

echo "📦 Проверяем package.json и yarn.lock..."
if [ ! -f package.json ]; then
    echo "❌ package.json не найден!"
    exit 1
fi

echo "🧹 Очищаем кеш yarn..."
yarn cache clean

echo "🗑️ Удаляем node_modules и yarn.lock..."
rm -rf node_modules yarn.lock

echo "📥 Переустанавливаем зависимости..."
yarn install

echo "🏗️ Проверяем сборку..."
yarn build

if [ $? -eq 0 ]; then
    echo "✅ Сборка frontend исправлена!"
    echo "🐳 Теперь можно попробовать: docker compose build frontend"
else
    echo "❌ Ошибка при сборке!"
    exit 1
fi