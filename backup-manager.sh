#!/bin/bash

BACKUP_DIR="/opt/backups"
PROJECT_DIR="/opt/shinomontaz"

# Функция для создания backup
create_backup() {
    echo "📦 Создание backup..."
    
    mkdir -p $BACKUP_DIR
    
    BACKUP_NAME="manual_backup_$(date +%Y%m%d_%H%M%S)"
    
    # Остановить сервисы
    cd $PROJECT_DIR
    docker-compose down
    
    # Создать backup
    tar -czf "$BACKUP_DIR/$BACKUP_NAME.tar.gz" \
        --exclude="node_modules" \
        --exclude=".git" \
        --exclude="*.log" \
        $PROJECT_DIR
    
    # Запустить сервисы обратно
    docker-compose up -d
    
    echo "✅ Backup создан: $BACKUP_NAME.tar.gz"
}

# Функция для просмотра backup'ов
list_backups() {
    echo "📋 Доступные backup'ы:"
    if [ -d "$BACKUP_DIR" ]; then
        cd $BACKUP_DIR
        ls -lht backup_*.tar.gz manual_backup_*.tar.gz 2>/dev/null | head -10
    else
        echo "Нет backup'ов"
    fi
}

# Функция для отката
rollback() {
    local backup_file="$1"
    
    if [ -z "$backup_file" ]; then
        echo "❌ Укажите файл backup для отката"
        echo "Используйте: $0 rollback <backup_file>"
        list_backups
        return 1
    fi
    
    if [ ! -f "$BACKUP_DIR/$backup_file" ]; then
        echo "❌ Backup файл не найден: $backup_file"
        list_backups
        return 1
    fi
    
    echo "🔄 Откат к backup: $backup_file"
    read -p "Вы уверены? Это остановит текущий сайт. (y/N): " confirm
    
    if [[ $confirm =~ ^[Yy]$ ]]; then
        # Остановить текущие сервисы
        cd $PROJECT_DIR
        docker-compose down
        
        # Создать emergency backup текущего состояния
        EMERGENCY_BACKUP="emergency_$(date +%Y%m%d_%H%M%S)"
        tar -czf "$BACKUP_DIR/$EMERGENCY_BACKUP.tar.gz" \
            --exclude="node_modules" \
            --exclude=".git" \
            --exclude="*.log" \
            $PROJECT_DIR
        echo "📦 Emergency backup создан: $EMERGENCY_BACKUP.tar.gz"
        
        # Восстановить из backup
        cd /
        tar -xzf "$BACKUP_DIR/$backup_file"
        
        # Запустить сервисы
        cd $PROJECT_DIR
        docker-compose up -d
        
        echo "✅ Откат завершен"
        echo "💾 Emergency backup сохранен как: $EMERGENCY_BACKUP.tar.gz"
    else
        echo "❌ Откат отменен"
    fi
}

# Функция для очистки старых backup'ов
cleanup_backups() {
    local keep_count=${1:-5}
    
    echo "🧹 Очистка backup'ов (оставляем последние $keep_count)..."
    
    cd $BACKUP_DIR
    
    # Очистить автоматические backup'ы
    ls -t backup_*.tar.gz 2>/dev/null | tail -n +$((keep_count + 1)) | xargs -r rm
    
    # Очистить manual backup'ы (оставляем больше)
    ls -t manual_backup_*.tar.gz 2>/dev/null | tail -n +$((keep_count * 2 + 1)) | xargs -r rm
    
    echo "✅ Очистка завершена"
}

# Функция для проверки состояния
check_status() {
    echo "📊 Состояние системы:"
    
    cd $PROJECT_DIR
    
    echo "Контейнеры:"
    docker-compose ps
    
    echo -e "\nПоследние backup'ы:"
    list_backups | head -5
    
    echo -e "\nРазмер backup директории:"
    du -sh $BACKUP_DIR 2>/dev/null || echo "Backup директория пуста"
    
    echo -e "\nТест подключения:"
    curl -I http://baseshinomontaz.ru/ 2>/dev/null | head -1 || echo "❌ Сайт недоступен"
}

# Главное меню
case "$1" in
    "backup"|"create")
        create_backup
        ;;
    "list"|"ls")
        list_backups
        ;;
    "rollback"|"restore")
        rollback "$2"
        ;;
    "cleanup"|"clean")
        cleanup_backups "$2"
        ;;
    "status"|"check")
        check_status
        ;;
    *)
        echo "🔧 Управление backup'ами и откатами"
        echo ""
        echo "Использование: $0 {backup|list|rollback|cleanup|status}"
        echo ""
        echo "  backup           - создать backup вручную"
        echo "  list             - показать доступные backup'ы"
        echo "  rollback <file>  - откатиться к указанному backup'у"
        echo "  cleanup [count]  - очистить старые backup'ы (по умолчанию оставить 5)"
        echo "  status           - показать состояние системы"
        echo ""
        echo "Примеры:"
        echo "  $0 backup"
        echo "  $0 list"
        echo "  $0 rollback backup_20250703_180000.tar.gz"
        echo "  $0 cleanup 10"
        ;;
esac