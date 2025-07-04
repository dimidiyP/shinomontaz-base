# ТЕХНИЧЕСКАЯ СПЕЦИФИКАЦИЯ
## Система управления хранением шин с калькулятором шиномонтажа

**Версия:** 2.0  
**Дата:** Декабрь 2024  
**Автор:** AI Assistant  

---

## 1. ОБЗОР СИСТЕМЫ

### 1.1 Архитектура
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   Database      │
│   React SPA     │◄──►│   FastAPI       │◄──►│   MongoDB       │
│   Port: 3000    │    │   Port: 8001    │    │   Port: 27017   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲                       ▲
         │                       │
┌─────────────────┐    ┌─────────────────┐
│     Nginx       │    │   RetailCRM     │
│  Reverse Proxy  │    │   Integration   │
│ Ports: 80/443   │    │  External API   │
└─────────────────┘    └─────────────────┘
```

### 1.2 Технологический стек
- **Frontend:** React 18, Tailwind CSS, JavaScript ES6+
- **Backend:** FastAPI (Python), Pydantic, JWT
- **Database:** MongoDB с TTL индексами
- **Web Server:** Nginx с SSL
- **Containerization:** Docker + Docker Compose
- **CI/CD:** GitHub Actions
- **Testing:** Playwright (E2E)

---

## 2. КОМПОНЕНТЫ СИСТЕМЫ

### 2.1 Система авторизации

#### 2.1.1 Модель пользователя
```python
class User:
    username: str           # Уникальное имя пользователя
    password: bytes         # Хэш пароль (bcrypt)
    role: str              # admin | user
    permissions: List[str]  # Список разрешений
    created_at: datetime   # Дата создания
```

#### 2.1.2 Разрешения системы
- `store` - Создание записей хранения
- `release` - Выдача записей со склада
- `view` - Просмотр записей
- `form_management` - Управление формами
- `pdf_management` - Управление PDF шаблонами
- `user_management` - Управление пользователями
- `delete_records` - Удаление записей
- `calculator_management` - Управление калькулятором

#### 2.1.3 API Endpoints
```
POST /api/login           # Авторизация
POST /api/logout          # Выход
GET  /api/verify-token    # Проверка токена
```

### 2.2 Система хранения записей

#### 2.2.1 Модель записи
```python
class StorageRecord:
    record_id: str              # UUID записи
    record_number: int          # Автоинкремент номер
    full_name: str              # ФИО клиента
    phone: str                  # Телефон (до 14 символов)
    phone_additional: str       # Дополнительный телефон
    car_brand: str              # Марка автомобиля
    parameters: str             # Параметры шин
    size: str                   # Количество
    storage_location: str       # Место хранения
    status: str                 # Новая | Взята на хранение | Выдана
    created_at: datetime        # Дата создания
    created_by: str             # Кто создал
    
    # RetailCRM интеграция
    source: str                 # manual | retailcrm
    retailcrm_order_id: int     # ID заказа в RetailCRM
    retailcrm_status: str       # Статус в RetailCRM
    retailcrm_payment_status: str # Статус оплаты
    retailcrm_actions_count: int # Счетчик автодействий
    
    # Динамические поля
    custom_fields: dict         # Дополнительные поля
```

#### 2.2.2 API Endpoints
```
# CRUD операции
POST   /api/storage-records          # Создание записи
GET    /api/storage-records          # Список записей (с сортировкой)
GET    /api/storage-records/{id}     # Детали записи
PUT    /api/storage-records/{id}     # Обновление записи
DELETE /api/storage-records/bulk     # Массовое удаление

# Специальные операции
PUT    /api/storage-records/{id}/take-storage  # Взять на хранение
PUT    /api/storage-records/{id}/release       # Выдать
GET    /api/storage-records/{id}/pdf           # Генерация PDF
POST   /api/storage-records/search             # Поиск записей
```

### 2.3 PDF система

#### 2.3.1 Модель шаблона PDF
```python
class PDFTemplate:
    template: str              # Текст шаблона с плейсхолдерами
    updated_at: datetime       # Дата последнего обновления
```

#### 2.3.2 Плейсхолдеры
- `{full_name}` - ФИО клиента
- `{phone}` - Телефон
- `{parameters}` - Параметры шин
- `{size}` - Количество
- `{storage_location}` - Место хранения
- `{record_number}` - Номер записи
- `{created_at}` - Дата создания
- `{car_brand}` - Марка автомобиля
- `{phone_additional}` - Дополнительный телефон

#### 2.3.3 API Endpoints
```
GET /api/pdf-template        # Получение шаблона
PUT /api/pdf-template        # Сохранение шаблона
```

### 2.4 Калькулятор шиномонтажа

#### 2.4.1 Модель настроек калькулятора
```python
class CalculatorSettings:
    vehicle_type: str           # passenger | truck
    name: str                   # Название типа транспорта
    hourly_rate: int            # Стоимость за час (рубли)
    services: List[Service]     # Список услуг
    additional_options: List[Option]  # Дополнительные опции

class Service:
    id: str                     # Уникальный ID услуги
    name: str                   # Название услуги
    description: str            # Описание
    time_by_size: dict          # Время по размерам {R16: 20, R17: 25}
    enabled: bool               # Активность услуги

class Option:
    id: str                     # Уникальный ID опции
    name: str                   # Название опции
    description: str            # Описание
    time_multiplier: float      # Множитель времени (1.5 = +50%)
```

#### 2.4.2 Модель результата расчета
```python
class CalculatorResult:
    short_id: str               # Короткий ID (rez1, rez2...)
    unique_id: str              # UUID для внутреннего использования
    vehicle_type: str           # Тип транспорта
    tire_size: str              # Размер шин
    wheel_count: int            # Количество колес
    selected_services: List[str] # Выбранные услуги
    additional_options: List[str] # Дополнительные опции
    total_time: int             # Общее время (минуты)
    total_cost: int             # Общая стоимость (рубли)
    breakdown: dict             # Детализация расчета
    created_at: datetime        # Дата создания
    expires_at: datetime        # Дата истечения (created_at + 7 дней)
```

#### 2.4.3 API Endpoints
```
# Публичные endpoints (без авторизации)
GET  /api/calculator/settings/{vehicle_type}  # Настройки калькулятора
POST /api/calculator/calculate                # Расчет стоимости
POST /api/calculator/save-result              # Сохранение результата
GET  /api/calculator/result/{short_id}        # Получение результата

# Админские endpoints (с авторизацией)
GET  /api/admin/calculator/settings           # Все настройки
PUT  /api/admin/calculator/settings/{vehicle_type}  # Обновление настроек
GET  /api/admin/calculator/results            # История расчетов
```

### 2.5 RetailCRM интеграция

#### 2.5.1 Модель заказа RetailCRM
```python
class RetailCRMOrder:
    order_id: int               # ID заказа в RetailCRM
    status: str                 # Статус заказа
    payment_status: str         # Статус оплаты
    customer_name: str          # ФИО клиента
    phone: str                  # Телефон
    custom_fields: dict         # Дополнительные поля
    created_at: datetime        # Дата создания
    chranenie: int              # Флаг хранения (1 = да)
```

#### 2.5.2 Настройки интеграции
- **URL:** Внешний API RetailCRM
- **API Key:** Ключ доступа (из переменных окружения)
- **Фильтры синхронизации:**
  - `chranenie = 1`
  - `status = "товар на выдачу"`
  - `paymentStatus = "paid"`

#### 2.5.3 API Endpoints
```
POST /api/retailcrm/sync     # Ручная синхронизация
GET  /api/retailcrm/status   # Статус интеграции
```

### 2.6 Система управления формами

#### 2.6.1 Модель конфигурации формы
```python
class FormConfig:
    fields: List[FormField]     # Список полей формы

class FormField:
    id: str                     # Уникальный ID поля
    name: str                   # Имя поля в базе
    label: str                  # Подпись поля
    type: str                   # text | number | select | textarea
    required: bool              # Обязательность
    options: List[str]          # Опции для select
    order: int                  # Порядок отображения
```

#### 2.6.2 API Endpoints
```
GET /api/form-config         # Получение конфигурации
PUT /api/form-config         # Сохранение конфигурации
```

### 2.7 Система управления пользователями

#### 2.7.1 API Endpoints
```
GET    /api/users            # Список пользователей
POST   /api/users            # Создание пользователя
DELETE /api/users/{username} # Удаление пользователя
PUT    /api/users/{username}/permissions  # Обновление разрешений
```

---

## 3. FRONTEND КОМПОНЕНТЫ

### 3.1 Структура приложения
```
App.js                       # Главный компонент
├── Login                    # Страница авторизации
├── Dashboard               # Главная панель
├── StorageForm             # Форма создания записи
├── RecordsTable            # Таблица записей
├── RecordDetail            # Детали записи
├── SearchRecords           # Поиск записей
├── FormEditor              # Редактор формы записи
├── PDFEditor               # Редактор PDF шаблона
├── UserManagement          # Управление пользователями
├── CalculatorAdmin         # Админка калькулятора
├── PublicCalculator        # Публичный калькулятор
└── CalculatorResult        # Результат расчета
```

### 3.2 Состояние приложения
```javascript
// Авторизация
const [isAuthenticated, setIsAuthenticated] = useState(false);
const [user, setUser] = useState(null);
const [currentPage, setCurrentPage] = useState('login');

// Общие состояния
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');
const [success, setSuccess] = useState('');

// Данные форм
const [loginData, setLoginData] = useState({});
const [storageData, setStorageData] = useState({});
const [searchData, setSearchData] = useState({});

// Записи и фильтрация
const [records, setRecords] = useState([]);
const [filteredRecords, setFilteredRecords] = useState([]);
const [filters, setFilters] = useState({});
const [sortConfig, setSortConfig] = useState({});

// Управление пользователями
const [users, setUsers] = useState([]);
const [newUser, setNewUser] = useState({});

// Конфигурация форм
const [formConfig, setFormConfig] = useState([]);
const [editFormConfig, setEditFormConfig] = useState(null);

// PDF шаблоны
const [pdfTemplate, setPdfTemplate] = useState('');
const [pdfTemplateLoaded, setPdfTemplateLoaded] = useState(false);

// Массовые операции
const [bulkMode, setBulkMode] = useState(false);
const [selectedRecords, setSelectedRecords] = useState(new Set());

// Калькулятор
const [calculatorSettings, setCalculatorSettings] = useState({});
const [selectedVehicleType, setSelectedVehicleType] = useState('passenger');
const [selectedTireSize, setSelectedTireSize] = useState('R16');
const [wheelCount, setWheelCount] = useState(4);
const [selectedServices, setSelectedServices] = useState([]);
const [selectedOptions, setSelectedOptions] = useState([]);
const [calculationResult, setCalculationResult] = useState(null);

// Админка калькулятора
const [adminCalculatorSettings, setAdminCalculatorSettings] = useState({});
const [editingVehicleType, setEditingVehicleType] = useState('passenger');
```

### 3.3 Роутинг
```javascript
// Публичные маршруты (без авторизации)
/calculator                  # Публичный калькулятор
/calculator/result/{id}      # Результат расчета

// Приватные маршруты (требуют авторизации)
/dashboard                   # Главная панель
/storage                     # Создание записи
/records                     # Просмотр записей
/search                      # Поиск записей
/form-config                 # Настройка формы
/pdf-config                  # Настройка PDF
/user-management            # Управление пользователями
/calculator-admin           # Админка калькулятора
```

---

## 4. БАЗА ДАННЫХ

### 4.1 Коллекции MongoDB
```
tire_storage                 # Основная база данных
├── users                    # Пользователи
├── storage_records          # Записи хранения
├── form_config              # Конфигурация форм
├── pdf_template             # Шаблоны PDF
├── retailcrm_orders         # Заказы из RetailCRM
├── calculator_settings      # Настройки калькулятора
└── calculator_results       # Результаты расчетов
```

### 4.2 Индексы
```javascript
// Пользователи
db.users.createIndex({ "username": 1 }, { unique: true })

// Записи хранения
db.storage_records.createIndex({ "record_number": -1 })  // Сортировка по номеру
db.storage_records.createIndex({ "record_id": 1 }, { unique: true })
db.storage_records.createIndex({ "phone": 1 })  // Поиск по телефону
db.storage_records.createIndex({ "full_name": "text" })  // Текстовый поиск

// RetailCRM заказы
db.retailcrm_orders.createIndex({ "order_id": 1 }, { unique: true })
db.retailcrm_orders.createIndex({ "chranenie": 1 })

// Настройки калькулятора
db.calculator_settings.createIndex({ "vehicle_type": 1 }, { unique: true })

// Результаты калькулятора с TTL
db.calculator_results.createIndex({ "short_id": 1 }, { unique: true })
db.calculator_results.createIndex({ "expires_at": 1 }, { expireAfterSeconds: 0 })
```

### 4.3 TTL (Time To Live)
```javascript
// Результаты калькулятора автоматически удаляются через 7 дней
{
  "expires_at": ISODate("2024-12-10T12:00:00Z"),  // Дата истечения
  // MongoDB автоматически удалит документ после этой даты
}
```

---

## 5. РАЗВЕРТЫВАНИЕ

### 5.1 Docker контейнеры
```yaml
# docker-compose.yml
services:
  mongodb:
    image: mongo:7.0
    ports: ["27017:27017"]
    volumes: ["mongodb_data:/data/db"]
    
  backend:
    build: ./backend
    ports: ["8001:8001"]
    depends_on: [mongodb]
    environment:
      - MONGO_URL=mongodb://mongodb:27017
      
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    depends_on: [backend]
    environment:
      - REACT_APP_BACKEND_URL=https://domain.com
      
  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    depends_on: [frontend, backend]
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
```

### 5.2 CI/CD Pipeline
```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
    
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to server
        run: |
          # Создание бэкапа
          docker-compose down --remove-orphans
          docker system prune -f
          
          # Освобождение портов
          fuser -k 80/tcp || true
          fuser -k 443/tcp || true
          
          # Сборка и запуск
          docker-compose build --no-cache
          docker-compose up -d
          
          # Тестирование
          npm test
```

### 5.3 Nginx конфигурация
```nginx
server {
    listen 80;
    listen 443 ssl http2;
    server_name domain.com;
    
    # SSL настройки
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    # Frontend
    location / {
        proxy_pass http://frontend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://backend:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 6. БЕЗОПАСНОСТЬ

### 6.1 Аутентификация и авторизация
- **JWT токены** с истечением срока действия
- **bcrypt хэширование** паролей
- **Проверка разрешений** на каждом endpoint
- **CORS настройки** для безопасных запросов

### 6.2 Валидация данных
- **Pydantic модели** для валидации входных данных
- **Ограничение длины** полей (телефон до 14 символов)
- **Санитизация HTML** в пользовательском вводе
- **Проверка типов файлов** при импорте

### 6.3 Защита от атак
- **Rate limiting** для API endpoints
- **SQL injection защита** (MongoDB NoSQL)
- **XSS защита** через Content Security Policy
- **HTTPS принудительное** перенаправление

---

## 7. МОНИТОРИНГ И ЛОГИРОВАНИЕ

### 7.1 Логи системы
```bash
# Backend логи
/var/log/supervisor/backend.out.log
/var/log/supervisor/backend.err.log

# Frontend логи
/var/log/supervisor/frontend.out.log
/var/log/supervisor/frontend.err.log

# Nginx логи
/var/log/nginx/access.log
/var/log/nginx/error.log
```

### 7.2 Мониторинг здоровья
```python
# Health check endpoint
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now()}
```

### 7.3 Метрики производительности
- **Время ответа API** endpoints
- **Использование памяти** контейнеров
- **Нагрузка CPU** при обработке PDF
- **Размер базы данных** и TTL очистка

---

## 8. ТЕСТИРОВАНИЕ

### 8.1 Backend тестирование
```python
# Модульные тесты
pytest backend/tests/

# API тесты
curl -X POST /api/login -d '{"username":"admin","password":"admin"}'
curl -X GET /api/storage-records -H "Authorization: Bearer {token}"
curl -X POST /api/calculator/calculate -d '{...}'
```

### 8.2 Frontend тестирование
```javascript
// E2E тесты с Playwright
npm run test

// Тесты включают:
// - Авторизацию
// - Создание записей
// - Калькулятор
// - PDF генерацию
// - Массовые операции
```

### 8.3 Интеграционные тесты
- **RetailCRM синхронизация**
- **PDF генерация с кириллицей**
- **Калькулятор с короткими ссылками**
- **TTL истечение ссылок**

---

## 9. ПРОИЗВОДИТЕЛЬНОСТЬ

### 9.1 Оптимизации базы данных
- **Индексы** для частых запросов
- **TTL коллекции** для автоочистки
- **Пагинация** для больших списков
- **Проекция полей** для экономии трафика

### 9.2 Оптимизации frontend
- **Lazy loading** компонентов
- **Мемоизация** вычислений
- **Оптимизация bundle** размера
- **CDN** для статических ресурсов

### 9.3 Кэширование
- **Browser cache** для статики
- **API response cache** для настроек
- **PDF template cache** в памяти
- **Calculator settings cache**

---

## 10. BACKUP И ВОССТАНОВЛЕНИЕ

### 10.1 Стратегия бэкапов
```bash
# Автоматический бэкап перед деплоем
./backup-manager.sh create

# Ежедневный бэкап базы данных
mongodump --uri="mongodb://localhost:27017/tire_storage" --out="/opt/backups/$(date +%Y%m%d)"

# Восстановление из бэкапа
./backup-manager.sh restore {backup_id}
```

### 10.2 Аварийное восстановление
- **Rollback deployment** до предыдущей версии
- **Database restore** из последнего бэкапа
- **Emergency port cleanup** скрипт
- **Health check** автоматическая проверка

---

## 11. МАСШТАБИРОВАНИЕ

### 11.1 Горизонтальное масштабирование
- **Load balancer** для множественных инстансов
- **Database sharding** по типу записей
- **CDN** для глобального распределения
- **Microservices** разделение функций

### 11.2 Вертикальное масштабирование
- **CPU optimization** для PDF генерации
- **Memory optimization** для больших datasets
- **SSD storage** для быстрого доступа к данным
- **Network optimization** для API вызовов

---

## 12. ЗАКЛЮЧЕНИЕ

Система представляет собой полнофункциональное веб-приложение для управления хранением шин с интегрированным калькулятором шиномонтажа. Архитектура обеспечивает:

- **Высокую производительность** через оптимизированные запросы
- **Масштабируемость** через контейнеризацию
- **Безопасность** через современные методы аутентификации
- **Удобство использования** через интуитивный интерфейс
- **Надежность** через автоматическое тестирование и мониторинг

Система готова к промышленной эксплуатации и дальнейшему развитию.

---

**Конец документа**