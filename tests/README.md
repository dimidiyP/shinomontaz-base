# Система автоматического тестирования

## 📋 Обзор

Система автоматического тестирования для приложения управления хранением шин, основанная на Playwright.

## 🚀 Быстрый старт

### Локальное тестирование
```bash
cd /opt/shinomontaz/tests
./run-tests.sh local core    # Базовые тесты на локальном сервере
./run-tests.sh production quick    # Быстрые тесты на продакшене
```

### Запуск всех тестов
```bash
./run-tests.sh production all    # Все тесты на продакшене
```

## 📊 Типы тестов

### 1. Core Features (`core-features.spec.js`)
- ✅ Аутентификация (admin/user)
- ✅ Создание записей на хранение  
- ✅ Просмотр и фильтрация записей
- ✅ Ограничение телефона (10 символов)
- ✅ Редактор конфигурации форм
- ✅ Drag&Drop индикаторы
- ✅ Кнопки экспорта/импорта
- ✅ Кликабельность номеров записей

### 2. Advanced Features (`advanced-features.spec.js`)
- ✅ Статус RetailCRM в деталях записи
- ✅ Кнопки перехода статусов
- ✅ PDF генерация из детального просмотра
- ✅ Поиск с новыми статусами
- ✅ Интерфейс управления RetailCRM
- ✅ Новые типы полей в редакторе
- ✅ Горизонтальный скролл таблицы

## 🔧 Генерация тестов для новых функций

### Автоматическое создание тестов
```bash
cd /opt/shinomontaz/tests
node generate-tests.js \
  --feature "new-feature-name" \
  --description "Описание новой функции" \
  --selectors "button.new-btn,input.new-field"
```

### Пример создания теста
```bash
node generate-tests.js \
  --feature "bulk-delete" \
  --description "Массовое удаление записей" \
  --selectors "input[type='checkbox'],button.delete-selected"
```

Это создаст файл `bulk-delete.spec.js` с базовой структурой теста.

## 📁 Структура проекта

```
/app/tests/
├── package.json              # Зависимости Playwright
├── playwright.config.js      # Конфигурация тестов
├── run-tests.sh              # Скрипт запуска тестов
├── generate-tests.js         # Генератор тестов
├── test-config.json          # Конфигурация генерируемых тестов
└── tests/
    ├── core-features.spec.js      # Основные функции
    ├── advanced-features.spec.js  # Продвинутые функции
    └── [generated-tests].spec.js  # Автогенерируемые тесты
```

## 🔄 Интеграция с CI/CD

### Автоматические тесты при деплое
При push в `main` ветку автоматически:
1. **Создается backup** текущей версии
2. **Деплоится** новая версия
3. **Запускаются быстрые тесты** (`run-tests.sh production quick`)
4. **При ошибке** происходит автоматический откат

### Ручной запуск полных тестов
Через GitHub Actions с `workflow_dispatch`:
```bash
# Запускает comprehensive-tests job
# Выполняет: ./run-tests.sh production all
```

## 📊 Отчеты тестирования

### HTML отчеты
- Генерируются автоматически в `playwright-report/`
- Копируются в `/opt/test-reports/frontend-YYYYMMDD_HHMMSS`
- Содержат скриншоты ошибок и видео

### Типы отчетов
- **HTML** - детальный отчет с видео и скриншотами
- **JSON** - машиночитаемый отчет
- **Line** - краткий текстовый отчет

## 🎯 Лучшие практики

### Добавление новых тестов
1. **Используйте генератор** для создания базовой структуры
2. **Добавляйте конкретную логику** в сгенерированные тесты
3. **Тестируйте разные роли** (admin/user)
4. **Включайте проверки ошибок** и граничных случаев

### Селекторы
```javascript
// ✅ Хорошо - семантические селекторы
page.locator('button:has-text("Записать на хранение")')
page.locator('table tbody tr td:first-child')

// ❌ Плохо - хрупкие селекторы
page.locator('#btn-123')
page.locator('.css-1a2b3c')
```

### Ожидания
```javascript
// ✅ Хорошо - явные ожидания
await expect(page.locator('text=Админ панель')).toBeVisible();
await page.waitForSelector('table tbody tr', { timeout: 10000 });

// ❌ Плохо - жесткие задержки
await page.waitForTimeout(5000);
```

## 🐛 Отладка тестов

### Локальная отладка
```bash
cd /app/tests
npx playwright test --debug          # Отладка с браузером
npx playwright test --headed         # Запуск с видимым браузером
npx playwright test --ui             # UI режим отладки
```

### Проблемы и решения

**Тест не находит элемент:**
```javascript
// Увеличить timeout
await page.waitForSelector('element', { timeout: 15000 });

// Проверить видимость
await expect(page.locator('element')).toBeVisible({ timeout: 10000 });
```

**Нестабильные тесты:**
```javascript
// Ждать загрузки данных
await page.waitForLoadState('networkidle');

// Ждать исчезновения лоадера
await page.waitForSelector('.loading', { state: 'detached' });
```

## 📈 Мониторинг качества

### Метрики успешности
- **Процент прохождения** основных тестов > 95%
- **Время выполнения** быстрых тестов < 3 минуты
- **Покрытие функций** всех критичных пользовательских путей

### Уведомления
- **Slack/Email** при падении тестов в CI/CD
- **Отчеты** о качестве после каждого деплоя
- **Тренды** качества в dashboard

## 🔧 Конфигурация

### Переменные окружения
```bash
BASE_URL=https://baseshinomontaz.ru    # URL для тестирования
CI=true                               # Режим CI/CD
```

### Браузеры
- **Chromium** (основной)
- **WebKit** (Safari)
- **Firefox** (опционально)

Система автоматически устанавливает нужные браузеры при первом запуске.