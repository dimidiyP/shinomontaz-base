# Tire Storage System - Production Management Guide

## 🎯 Режимы работы системы

Система поддерживает два режима работы:

### 1. Docker Mode (Production)
- Используется для автоматических деплоев через GitHub Actions
- Все сервисы запускаются в контейнерах
- Управление через docker-compose

### 2. Supervisor Mode (Fallback)
- Запасной режим при проблемах с Docker
- Все сервисы запускаются напрямую через supervisor
- Более стабильная работа для долгосрочной эксплуатации

## 🚀 Команды управления

### Проверка статуса системы
```bash
# Проверить статус supervisor сервисов
sudo supervisorctl status

# Проверить статус Docker контейнеров
docker-compose ps

# Запустить полную проверку здоровья
/app/health_monitor.sh
```

### Переключение в Supervisor режим (рекомендуется для стабильности)
```bash
# Автоматический переход
/app/emergency_fallback.sh

# Или вручную:
docker-compose down
sudo supervisorctl start all
```

### Переключение в Docker режим
```bash
# Остановить supervisor сервисы
sudo supervisorctl stop all

# Запустить Docker
docker-compose up -d
```

## 🔧 Устранение проблем

### Конфликт портов (главная причина сбоев)
```bash
# Освободить все порты
sudo supervisorctl stop all
docker-compose down
sudo fuser -k 80/tcp 443/tcp 3000/tcp 8001/tcp 27017/tcp

# Проверить свободные порты
netstat -tlnp | grep -E ':(80|443|3000|8001|27017)'
```

### Восстановление после сбоя
```bash
# 1. Экстренное восстановление
/app/emergency_fallback.sh

# 2. Если не помогло - полная перезагрузка
sudo reboot

# 3. После перезагрузки
sudo supervisorctl start all
```

## 📊 Мониторинг

### Автоматический мониторинг
- Health check каждые 5 минут (cron job)
- Логи: `/var/log/health_monitor.log`
- Автоматический перезапуск при сбоях

### Ручная проверка
```bash
# Проверить основные URL
curl -I https://baseshinomontaz.ru/
curl -X POST -H "Content-Type: application/json" -d '{"username":"admin","password":"admin"}' http://localhost/api/login

# Проверить логи
tail -f /var/log/supervisor/backend.err.log
tail -f /var/log/supervisor/frontend.out.log
tail -f /var/log/health_monitor.log
```

## 🎛️ Основные сервисы

| Сервис | Порт | Описание |
|--------|------|----------|
| Frontend | 3000 | React приложение |
| Backend | 8001 | FastAPI сервер |
| MongoDB | 27017 | База данных |
| Nginx | 80/443 | Reverse proxy |

## 🔑 Важные файлы

- `/app/health_monitor.sh` - Скрипт мониторинга
- `/app/emergency_fallback.sh` - Экстренное восстановление
- `/app/frontend/.env` - Настройки frontend
- `/etc/supervisor/conf.d/` - Конфигурация supervisor
- `/etc/nginx/nginx.conf` - Конфигурация nginx

## 📞 Экстренные действия

### Сайт недоступен
```bash
# 1. Быстрая проверка
sudo supervisorctl status
/app/health_monitor.sh

# 2. Экстренное восстановление
/app/emergency_fallback.sh

# 3. Если не помогло
sudo reboot
```

### После деплоя сайт не работает
```bash
# Вернуться к supervisor режиму
/app/emergency_fallback.sh
```

### MongoDB не запускается
```bash
# Проверить занятость порта
netstat -tlnp | grep :27017

# Если порт занят - убить процесс
sudo fuser -k 27017/tcp

# Запустить MongoDB
sudo supervisorctl start mongodb
```

## 🛡️ Стабильная конфигурация (рекомендуется)

Для максимальной стабильности рекомендуется работать в **Supervisor режиме**:

1. Остановить Docker: `docker-compose down`
2. Запустить supervisor: `sudo supervisorctl start all`
3. Проверить: `/app/health_monitor.sh`

Этот режим более стабильный и менее подвержен конфликтам портов.

## 📝 Логирование

- Backend: `/var/log/supervisor/backend.err.log`
- Frontend: `/var/log/supervisor/frontend.out.log`
- MongoDB: `/var/log/mongodb.err.log`
- Nginx: `/var/log/supervisor/nginx.err.log`
- Health Monitor: `/var/log/health_monitor.log`

## 🎯 Сайт работает на

- **Production**: https://baseshinomontaz.ru/
- **Local API**: http://localhost:8001/api/
- **Local Frontend**: http://localhost:3000/

---

**Для экстренных случаев всегда используйте:** `/app/emergency_fallback.sh`