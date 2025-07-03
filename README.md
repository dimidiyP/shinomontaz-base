# Система управления хранением шин

Веб-приложение для управления хранением шин с интеграцией RetailCRM.

## 🚀 Автоматический деплой

Настроен **автоматический CI/CD** через GitHub Actions:
- При push в `main` ветку код автоматически деплоится на сервер
- Создается backup перед каждым деплоем
- При ошибке происходит автоматический откат

## 📦 Система backup'ов

### Автоматические backup'ы
- Создаются **перед каждым деплоем**
- Хранятся в `/opt/backups/`
- Автоматически удаляются старые (оставляются последние 5)

### Ручное управление backup'ами
```bash
# Создать backup вручную
./backup-manager.sh backup

# Посмотреть доступные backup'ы
./backup-manager.sh list

# Откатиться к backup'у
./backup-manager.sh rollback backup_20250703_180000.tar.gz

# Проверить состояние системы
./backup-manager.sh status

# Очистить старые backup'ы
./backup-manager.sh cleanup
```

## 🔧 Диагностика проблем

```bash
# Проверить состояние сервисов
./fix-nginx.sh check

# Быстрое исправление nginx
./fix-nginx.sh fix

# Переключиться на простую HTTP конфигурацию
./fix-nginx.sh simple

# Протестировать подключение
./fix-nginx.sh test
```

## ⚡ Быстрые команды

```bash
# Перезапустить все сервисы
docker-compose restart

# Просмотреть логи
docker-compose logs -f

# Пересобрать и запустить
docker-compose down && docker-compose build --no-cache && docker-compose up -d
```

## 🔄 Workflow разработки

1. **Внести изменения** в код локально
2. **Сделать commit и push** в main ветку
3. **GitHub Actions автоматически**:
   - Создаст backup текущей версии
   - Задеплоит новую версию
   - Проверит работоспособность
   - При ошибке сделает автоматический откат

## 🛠️ Компоненты системы

- **Backend**: FastAPI + MongoDB
- **Frontend**: React + Tailwind CSS  
- **Веб-сервер**: Nginx с SSL (Let's Encrypt)
- **Интеграция**: RetailCRM API v5
- **Деплой**: Docker Compose + GitHub Actions

## 📊 Мониторинг

- **Здоровье API**: https://baseshinomontaz.ru/api/health
- **Логи**: `docker-compose logs`
- **Статус**: `./backup-manager.sh status`