# Система управления хранением шин

Полноценная система для управления хранением шин в шинном бизнесе.

## Функции

- ✅ Авторизация с ролями (admin/user)
- ✅ Записать на хранение
- ✅ Выдать с хранения  
- ✅ Просмотр записей с фильтрацией
- ✅ PDF генерация актов
- ✅ Excel экспорт/импорт
- ✅ Управление пользователями
- ✅ Настройка форм и шаблонов

## Технологии

- **Backend**: FastAPI (Python)
- **Frontend**: React
- **Database**: MongoDB
- **Deployment**: Docker + Nginx

## Развертывание на сервере

### Быстрая установка

```bash
# Скачайте и запустите скрипт установки
wget https://raw.githubusercontent.com/YOUR_REPO/main/install.sh
chmod +x install.sh
sudo bash install.sh
```

### Ручная установка

1. Клонируйте репозиторий:
```bash
git clone https://github.com/YOUR_REPO/shinomontaz.git
cd shinomontaz
```

2. Настройте переменные окружения:
```bash
cp .env.example .env
# Отредактируйте .env файл
```

3. Запустите приложение:
```bash
docker-compose up -d
```

## Доступ к приложению

- **URL**: https://baseshinomontaz.ru
- **Admin**: admin / K2enlzuzz2
- **User**: user / user

## Автоматическое обновление через GitHub

Настроено автоматическое обновление при push в main ветку через GitHub Actions.

## Поддержка

Для поддержки и вопросов обращайтесь к разработчику.