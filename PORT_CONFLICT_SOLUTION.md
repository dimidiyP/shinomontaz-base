# Решение проблемы "address already in use" при деплое

## Проблема
```
Error response from daemon: failed to set up container networking: driver failed programming external connectivity on endpoint shinomontaz_nginx: failed to bind host port for 0.0.0.0:80:172.18.0.5:80/tcp: address already in use
```

## Причина
Порт 80 (или 443) уже занят на сервере старыми Docker контейнерами или другими процессами.

## Решения

### 1. Автоматическое решение (уже добавлено в deploy.yml)
Добавлены команды принудительной очистки:
- `docker-compose down --remove-orphans`
- Остановка контейнеров использующих порты 80/443
- `docker system prune -f`
- `sudo fuser -k 80/tcp` и `sudo fuser -k 443/tcp`

### 2. Ручное решение на сервере
Если деплой все еще падает, выполните на сервере:

```bash
# Перейти в папку проекта
cd /opt/shinomontaz

# Запустить экстренную очистку
./emergency-cleanup.sh

# Или вручную:
docker-compose down --remove-orphans
docker stop $(docker ps -q)
docker rm $(docker ps -aq)
docker system prune -af
sudo fuser -k 80/tcp
sudo fuser -k 443/tcp

# Перезапустить
docker-compose up -d
```

### 3. Проверка портов
```bash
# Проверить что использует порт 80
sudo netstat -tlnp | grep :80
sudo lsof -i :80

# Проверить Docker контейнеры
docker ps --filter "publish=80"
docker ps --filter "publish=443"
```

## Проверка после исправления
1. Деплой должен пройти без ошибок
2. Nginx должен быть доступен на портах 80 и 443
3. Приложение должно работать по HTTPS