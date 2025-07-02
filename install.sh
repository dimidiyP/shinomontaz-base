#!/bin/bash

# Скрипт установки приложения на VPS сервер
# Использование: bash install.sh

echo "🚀 Установка системы управления хранением шин на сервер..."

# Обновление системы
echo "📦 Обновление системы..."
apt update && apt upgrade -y

# Установка Docker
echo "🐳 Установка Docker..."
apt install -y apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -
add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
apt update
apt install -y docker-ce

# Установка Docker Compose
echo "🔧 Установка Docker Compose..."
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Установка Git
echo "📋 Установка Git..."
apt install -y git

# Создание директории проекта
echo "📁 Создание директории проекта..."
mkdir -p /opt/shinomontaz
cd /opt/shinomontaz

# Клонирование репозитория (нужно будет указать ваш репозиторий)
echo "📥 Клонирование репозитория..."
# git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git .

# Установка Certbot для SSL
echo "🔒 Установка Certbot..."
apt install -y certbot python3-certbot-nginx

# Получение SSL сертификата
echo "🔐 Получение SSL сертификата..."
certbot certonly --standalone -d baseshinomontaz.ru -d www.baseshinomontaz.ru --email your-email@example.com --agree-tos --non-interactive

# Создание файла с переменными окружения
echo "⚙️ Создание конфигурации..."
cat > .env << EOF
MONGO_URL=mongodb://mongodb:27017
DB_NAME=tire_storage
REACT_APP_BACKEND_URL=https://baseshinomontaz.ru
EOF

# Запуск приложения
echo "🚀 Запуск приложения..."
docker-compose up -d

# Настройка автообновления SSL сертификата
echo "🔄 Настройка автообновления SSL..."
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -

# Настройка автозапуска Docker
echo "🔄 Настройка автозапуска..."
systemctl enable docker

echo "✅ Установка завершена!"
echo "🌐 Ваше приложение доступно по адресу: https://baseshinomontaz.ru"
echo ""
echo "📋 Следующие шаги:"
echo "1. Настройте DNS записи для домена baseshinomontaz.ru на IP: 83.222.18.104"
echo "2. Создайте GitHub репозиторий и загрузите код"
echo "3. Настройте GitHub Actions для автоматического деплоя"
echo "4. Добавьте SSH ключ в GitHub Secrets как SSH_PRIVATE_KEY"