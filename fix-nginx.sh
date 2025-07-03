#!/bin/bash

echo "🔧 Диагностика и исправление nginx..."

# Функция для проверки статуса контейнеров
check_containers() {
    echo "📊 Проверка контейнеров:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

# Функция для проверки логов
check_logs() {
    echo "📋 Логи nginx:"
    docker logs shinomontaz_nginx --tail 20
    
    echo "📋 Логи frontend:"
    docker logs shinomontaz_frontend --tail 10
    
    echo "📋 Логи backend:"
    docker logs shinomontaz_backend --tail 10
}

# Функция для тестирования конфигурации nginx
test_nginx_config() {
    echo "🧪 Тестирование nginx конфигурации:"
    docker exec shinomontaz_nginx nginx -t
}

# Функция для быстрого исправления
quick_fix() {
    echo "🚑 Быстрое исправление..."
    
    # Остановить все сервисы
    docker-compose down
    
    # Удалить проблемные контейнеры
    docker container prune -f
    
    # Пересобрать frontend
    docker-compose build --no-cache frontend
    
    # Запустить все сервисы
    docker-compose up -d
    
    # Подождать запуска
    sleep 30
    
    echo "✅ Исправление завершено"
}

# Функция для переключения на простую конфигурацию
use_simple_config() {
    echo "🔄 Переключение на простую HTTP конфигурацию..."
    
    # Скопировать простую конфигурацию
    cp nginx-simple.conf nginx.conf
    
    # Перезапустить nginx
    docker-compose restart nginx
    
    echo "✅ Переключение завершено"
}

# Функция для тестирования подключения
test_connection() {
    echo "🌐 Тестирование подключения..."
    
    echo "HTTP тест:"
    curl -I http://baseshinomontaz.ru/ || echo "❌ HTTP не работает"
    
    echo "HTTPS тест:"
    curl -I https://baseshinomontaz.ru/ || echo "❌ HTTPS не работает"
    
    echo "Backend API тест:"
    curl https://baseshinomontaz.ru/api/health || echo "❌ Backend API не работает"
}

# Главное меню
case "$1" in
    "check")
        check_containers
        check_logs
        test_nginx_config
        ;;
    "fix")
        quick_fix
        ;;
    "simple")
        use_simple_config
        ;;
    "test")
        test_connection
        ;;
    *)
        echo "Использование: $0 {check|fix|simple|test}"
        echo "  check  - проверить статус и логи"
        echo "  fix    - быстрое исправление"
        echo "  simple - переключиться на простую HTTP конфигурацию"
        echo "  test   - протестировать подключение"
        ;;
esac