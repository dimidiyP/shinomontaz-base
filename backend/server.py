from fastapi import FastAPI, HTTPException, Depends, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
import os
from pymongo import MongoClient
import uuid
from datetime import datetime
import bcrypt
from jose import JWTError, jwt
from datetime import timedelta
import io
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import pandas as pd
import tempfile
import requests
import threading
import time
from apscheduler.schedulers.background import BackgroundScheduler
import logging

# Configuration
SECRET_KEY = "your-secret-key-here"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# RetailCRM Configuration
RETAILCRM_API_URL = "https://shlepakov.retailcrm.ru"
RETAILCRM_API_KEY = "mTOKpWXudFmK5ZIWvLpQykiDzBJ2ffHM"

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'tire_storage')

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

# Collections
users_collection = db.users
storage_records_collection = db.storage_records
form_config_collection = db.form_config
pdf_template_collection = db.pdf_template
retailcrm_orders_collection = db.retailcrm_orders

# Calculator collections
calculator_settings_collection = db.calculator_settings
calculator_results_collection = db.calculator_results

# Security scheme
security = HTTPBearer()

# Initialize default users and data
def init_default_data():
    # Create default users if they don't exist
    if users_collection.count_documents({}) == 0:
        admin_password = bcrypt.hashpw("admin".encode('utf-8'), bcrypt.gensalt())
        user_password = bcrypt.hashpw("user".encode('utf-8'), bcrypt.gensalt())
        
        users_collection.insert_many([
            {
                "username": "admin",
                "password": admin_password,
                "role": "admin",
                "permissions": ["store", "release", "view", "form_management", "pdf_management", "user_management", "delete_records", "calculator_management"]
            },
            {
                "username": "user", 
                "password": user_password,
                "role": "user",
                "permissions": ["store", "view"]
            }
        ])
    
    # Create default form configuration
    if form_config_collection.count_documents({}) == 0:
        form_config_collection.insert_one({
            "fields": [
                {"name": "full_name", "label": "ФИО", "type": "text", "required": True},
                {"name": "phone", "label": "Номер телефона", "type": "text", "required": True},
                {"name": "phone_additional", "label": "Доп номер телефона", "type": "text", "required": False},
                {"name": "car_brand", "label": "Марка машины", "type": "text", "required": True},
                {"name": "parameters", "label": "Параметры", "type": "text", "required": True},
                {"name": "size", "label": "Размер", "type": "text", "required": True},
                {"name": "storage_location", "label": "Место хранения", "type": "select", "required": True, "options": ["Бекетова 3а.к15", "Московское шоссе 22к1"]}
            ]
        })
    
    # Create default PDF template
    if pdf_template_collection.count_documents({}) == 0:
        pdf_template_collection.insert_one({
            "template": "Я {full_name}, {phone}, оставил на хранение {parameters}, {size}, в Шинном Бюро по адресу {storage_location}, номер акта {record_id} {created_at}. Подпись: _________________"
        })
    
    # Initialize calculator settings
    if calculator_settings_collection.count_documents({}) == 0:
        # Default settings for passenger cars
        passenger_services = [
            {
                "id": "mount_demount",
                "name": "Монтаж/демонтаж шины",
                "description": "Снятие старой шины с диска и установка новой",
                "time_by_size": {
                    "R13": 15, "R14": 15, "R15": 20, "R16": 20, 
                    "R17": 25, "R18": 25, "R19": 30, "R20": 35
                },
                "enabled": True
            },
            {
                "id": "balancing",
                "name": "Балансировка колеса",
                "description": "Устранение дисбаланса колеса для комфортной езды",
                "time_by_size": {
                    "R13": 8, "R14": 8, "R15": 10, "R16": 10,
                    "R17": 12, "R18": 12, "R19": 15, "R20": 18
                },
                "enabled": True
            },
            {
                "id": "wheel_remove_install",
                "name": "Снятие/установка колеса",
                "description": "Снятие колеса с автомобиля и установка обратно",
                "time_by_size": {
                    "R13": 5, "R14": 5, "R15": 5, "R16": 5,
                    "R17": 7, "R18": 7, "R19": 10, "R20": 12
                },
                "enabled": True
            },
            {
                "id": "valve_replacement",
                "name": "Замена вентиля",
                "description": "Замена резинового или металлического вентиля",
                "time_by_size": {
                    "R13": 3, "R14": 3, "R15": 3, "R16": 3,
                    "R17": 3, "R18": 3, "R19": 3, "R20": 3
                },
                "enabled": True
            },
            {
                "id": "tire_repair",
                "name": "Ремонт шины",
                "description": "Заклейка прокола или мелкого повреждения",
                "time_by_size": {
                    "R13": 20, "R14": 20, "R15": 25, "R16": 25,
                    "R17": 30, "R18": 30, "R19": 35, "R20": 40
                },
                "enabled": True
            },
            {
                "id": "wheel_straightening",
                "name": "Правка диска",
                "description": "Восстановление геометрии деформированного диска",
                "time_by_size": {
                    "R13": 30, "R14": 30, "R15": 35, "R16": 35,
                    "R17": 40, "R18": 40, "R19": 45, "R20": 50
                },
                "enabled": True
            }
        ]
        
        # Default settings for trucks
        truck_services = [
            {
                "id": "mount_demount",
                "name": "Монтаж/демонтаж шины",
                "description": "Снятие старой шины с диска и установка новой (грузовые)",
                "time_by_size": {
                    "R17.5": 45, "R19.5": 50, "R22.5": 60, "R24.5": 70
                },
                "enabled": True
            },
            {
                "id": "balancing",
                "name": "Балансировка колеса",
                "description": "Балансировка грузового колеса",
                "time_by_size": {
                    "R17.5": 20, "R19.5": 25, "R22.5": 30, "R24.5": 35
                },
                "enabled": True
            },
            {
                "id": "wheel_remove_install",
                "name": "Снятие/установка колеса",
                "description": "Снятие грузового колеса с автомобиля и установка",
                "time_by_size": {
                    "R17.5": 15, "R19.5": 18, "R22.5": 25, "R24.5": 30
                },
                "enabled": True
            },
            {
                "id": "valve_replacement",
                "name": "Замена вентиля",
                "description": "Замена вентиля на грузовом колесе",
                "time_by_size": {
                    "R17.5": 5, "R19.5": 5, "R22.5": 7, "R24.5": 7
                },
                "enabled": True
            },
            {
                "id": "tire_repair",
                "name": "Ремонт шины",
                "description": "Ремонт грузовой шины",
                "time_by_size": {
                    "R17.5": 40, "R19.5": 45, "R22.5": 50, "R24.5": 60
                },
                "enabled": True
            }
        ]
        
        calculator_settings_collection.insert_many([
            {
                "vehicle_type": "passenger",
                "name": "Легковой транспорт",
                "hourly_rate": 2000,  # рублей за час
                "services": passenger_services,
                "additional_options": [
                    {
                        "id": "runflat",
                        "name": "RunFlat шины",
                        "description": "Дополнительное время на работу с шинами RunFlat",
                        "time_multiplier": 1.5
                    },
                    {
                        "id": "low_profile",
                        "name": "Низкопрофильные шины",
                        "description": "Дополнительное время на работу с низкопрофильными шинами",
                        "time_multiplier": 1.3
                    },
                    {
                        "id": "damaged_rim",
                        "name": "Поврежденный диск",
                        "description": "Дополнительное время при работе с поврежденным диском",
                        "time_multiplier": 1.4
                    }
                ]
            },
            {
                "vehicle_type": "truck",
                "name": "Грузовой транспорт",
                "hourly_rate": 3000,  # рублей за час
                "services": truck_services,
                "additional_options": [
                    {
                        "id": "heavy_duty",
                        "name": "Особо тяжелые условия",
                        "description": "Дополнительное время для сложных грузовых работ",
                        "time_multiplier": 1.3
                    }
                ]
            }
        ])

# Models
class LoginRequest(BaseModel):
    username: str
    password: str

class StorageRecord(BaseModel):
    # Static fields that always exist
    full_name: str
    phone: str
    phone_additional: Optional[str] = None
    car_brand: str
    parameters: str
    size: str
    storage_location: str
    # Dynamic fields will be handled separately

class User(BaseModel):
    username: str
    role: str
    permissions: List[str]

# Calculator models
class CalculatorService(BaseModel):
    id: str
    name: str
    description: str
    time_by_size: dict
    enabled: bool

class CalculatorOption(BaseModel):
    id: str
    name: str
    description: str
    time_multiplier: float

class CalculatorSettings(BaseModel):
    vehicle_type: str
    name: str
    hourly_rate: int
    services: List[CalculatorService]
    additional_options: List[CalculatorOption]

class CalculatorRequest(BaseModel):
    vehicle_type: str
    tire_size: str
    wheel_count: int
    selected_services: List[str]
    additional_options: List[str] = []

class CalculatorResult(BaseModel):
    vehicle_type: str
    tire_size: str
    wheel_count: int
    selected_services: List[str]
    additional_options: List[str]
    total_time: int  # minutes
    total_cost: int  # rubles
    breakdown: dict

# RetailCRM Integration Class
class RetailCRMIntegration:
    def __init__(self):
        self.api_url = RETAILCRM_API_URL
        self.api_key = RETAILCRM_API_KEY
        self.scheduler = BackgroundScheduler()
        
    def fetch_orders(self):
        """Fetch orders from RetailCRM API v5 with chranenie = 1, status = 'товар на выдачу' and paymentStatus = 'paid'"""
        try:
            url = f"{self.api_url}/api/v5/orders"
            headers = {
                'X-API-KEY': self.api_key,
                'Content-Type': 'application/json'
            }
            
            # Filter orders where custom field 'chranenie' = true
            params = {
                'filter[customFields][chranenie]': 'true',
                'limit': 100
            }
            
            response = requests.get(url, headers=headers, params=params, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and 'orders' in data:
                    orders = self.map_order_fields(data['orders'])
                    self.save_orders(orders)
                    logger.info(f"Fetched and saved {len(orders)} orders from RetailCRM")
                else:
                    logger.warning("No orders found or RetailCRM API returned error")
            else:
                logger.error(f"RetailCRM API request failed: {response.status_code} - {response.text}")
                
        except Exception as e:
            logger.error(f"Error fetching orders from RetailCRM: {str(e)}")
    
    def map_order_fields(self, orders):
        """Map RetailCRM fields to our storage record format"""
        mapped_orders = []
        
        for order in orders:
            try:
                # Проверяем статус заказа - должен быть готов к выдаче
                order_status = order.get('status', '')
                if order_status not in ['in-stock', 'client-confirmed']:
                    continue
                
                # Проверяем статус оплаты - должен быть оплачен
                has_paid_payment = False
                payments = order.get('payments', {})
                for payment_id, payment in payments.items():
                    if payment.get('status') == 'paid':
                        has_paid_payment = True
                        break
                
                if not has_paid_payment:
                    continue
                
                # Create a storage record format compatible entry
                storage_record = {
                    "record_id": str(uuid.uuid4()),
                    "record_number": 0,  # Будет присвоен в save_orders
                    "full_name": self.extract_full_name(order),
                    "phone": self.extract_phone(order),
                    "phone_additional": "",
                    "car_brand": self.extract_car_brand(order),  # From type_avto_zakaz
                    "parameters": self.extract_parameters(order),
                    "size": self.extract_size(order),
                    "storage_location": self.extract_storage_location(order),  # From tochka_vydachi
                    "status": "Новая",  # Новый статус для записей из RetailCRM
                    "created_at": datetime.now(),
                    "created_by": "retailcrm_sync",
                    "custom_field_1751496388330": order.get('number', ''),
                    "retailcrm_order_id": order.get('id'),
                    "retailcrm_external_id": order.get('externalId'),
                    "retailcrm_order_number": order.get('number', ''),  # Номер заказа CRM
                    "retailcrm_status": order.get('status', ''),  # Текущий статус в RetailCRM
                    "retailcrm_payment_status": self.extract_payment_status(order),  # Статус оплаты
                    "retailcrm_sync_count": 0,  # Счетчик синхронизаций
                    "source": "retailcrm"
                }
                
                mapped_orders.append(storage_record)
            except Exception as e:
                logger.error(f"Error mapping order {order.get('id', 'unknown')}: {str(e)}")
                continue
        
        return mapped_orders
    
    def extract_full_name(self, order):
        """Extract full name from order"""
        first_name = order.get('firstName', '')
        last_name = order.get('lastName', '')
        return f"{first_name} {last_name}".strip() or "Не указано"
    
    def extract_phone(self, order):
        """Extract phone from order"""
        return order.get('phone', '') or order.get('phone1', '') or ""
    
    def extract_storage_location(self, order):
        """Extract storage location from tochka_vydachi field"""
        return order.get('customFields', {}).get('tochka_vydachi', '') or "Не указано"
    
    def extract_car_brand(self, order):
        """Extract car brand from type_avto_zakaz field"""
        return order.get('customFields', {}).get('type_avto_zakaz', '') or "Не указано"
    
    def extract_parameters(self, order):
        """Extract tire parameters from order items"""
        if 'items' in order and order['items']:
            items = []
            for item in order['items']:
                offer = item.get('offer', {})
                name = offer.get('name', item.get('productName', ''))
                if name:
                    items.append(name)
            return ', '.join(items) if items else "Не указано"
        return "Не указано"
    
    def extract_size(self, order):
        """Extract size/quantity from order items"""
        if 'items' in order and order['items']:
            total_quantity = sum(item.get('quantity', 0) for item in order['items'])
            return f"{total_quantity} шт." if total_quantity > 0 else "Не указано"
        return "Не указано"
    
    def extract_payment_status(self, order):
        """Extract payment status from order payments"""
        payments = order.get('payments', {})
        if not payments:
            return "not-paid"
        
        # Ищем оплаченные платежи
        for payment_id, payment in payments.items():
            if payment.get('status') == 'paid':
                return "paid"
        
        return "not-paid"
    
    def generate_next_record_id(self):
        """Generate next record ID similar to existing logic"""
        last_record = storage_records_collection.find_one(
            {}, 
            sort=[("record_number", -1)]
        )
        
        if last_record and "record_number" in last_record:
            return last_record["record_number"] + 1
        else:
            return 1
    
    def save_orders(self, orders):
        """Save orders to database, avoid duplicates"""
        # Получаем последний номер записи один раз для всех заказов
        last_record = storage_records_collection.find_one(
            {}, 
            sort=[("record_number", -1)]
        )
        
        next_record_number = last_record["record_number"] + 1 if last_record and "record_number" in last_record else 1
        
        for i, order in enumerate(orders):
            # Check if order already exists by retailcrm_order_id
            existing = storage_records_collection.find_one({
                "retailcrm_order_id": order.get("retailcrm_order_id")
            })
            
            if not existing:
                # Присваиваем уникальный номер для каждой записи
                order["record_number"] = next_record_number + i
                storage_records_collection.insert_one(order)
                logger.info(f"Saved new order from RetailCRM: {order.get('custom_field_1751496388330')} with record_number {order['record_number']}")
            else:
                logger.debug(f"Order already exists: {order.get('custom_field_1751496388330')}")
    
    def start_scheduler(self):
        """Start the background scheduler"""
        self.scheduler.add_job(
            self.fetch_orders,
            'interval',
            hours=1,  # Every 1 hour to reduce server load
            id='retailcrm_sync'
        )
        self.scheduler.start()
        logger.info("RetailCRM scheduler started - running every 1 hour")
    
    def update_retailcrm_status(self, order_number, new_status):
        """Update order status in RetailCRM"""
        try:
            if not order_number:
                return False
                
            url = f"{self.api_url}/api/v5/orders/{order_number}/edit"
            headers = {
                'X-API-KEY': self.api_key,
                'Content-Type': 'application/json'
            }
            
            data = {
                'status': new_status,
                'by': 'number'
            }
            
            response = requests.post(url, headers=headers, json=data, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    logger.info(f"Updated RetailCRM order {order_number} status to {new_status}")
                    return True
                else:
                    logger.error(f"Failed to update RetailCRM status: {result.get('errorMsg', 'Unknown error')}")
                    return False
            else:
                logger.error(f"RetailCRM API error: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Error updating RetailCRM status: {str(e)}")
            return False
    
    def get_retailcrm_status_text(self, record):
        """Get retail status text for display"""
        retailcrm_order_number = record.get("retailcrm_order_number") or record.get("custom_field_1751496388330")
        
        if not retailcrm_order_number:
            return "нет номера ритейла"
        
        current_status = record.get("retailcrm_status", "")
        our_status = record.get("status", "")
        
        # Check for status mismatch
        if current_status and our_status:
            if our_status == "Выдана с хранения" and current_status != "выдан клиенту":
                if current_status != "товар на складе С/X":
                    return "Расхождение по статусам"
            elif our_status == "Взята на хранение" and current_status != "товар на складе С/X":
                if current_status != "новый":
                    return "Расхождение по статусам"
        
        return current_status or "статус не определен"
    
    def stop_scheduler(self):
        """Stop the scheduler"""
        if self.scheduler.running:
            self.scheduler.shutdown()
            logger.info("RetailCRM scheduler stopped")

# Global RetailCRM instance
retailcrm = RetailCRMIntegration()

# Global RetailCRM instance
retailcrm = RetailCRMIntegration()
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = users_collection.find_one({"username": username})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        return {
            "username": user["username"],
            "role": user["role"],
            "permissions": user["permissions"]
        }
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def generate_next_record_id():
    # Get the highest existing record ID and increment
    last_record = storage_records_collection.find_one(
        {}, 
        sort=[("record_number", -1)]
    )
    
    if last_record and "record_number" in last_record:
        return last_record["record_number"] + 1
    else:
        return 1

# Routes
@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}

@app.post("/api/login")
async def login(request: LoginRequest):
    user = users_collection.find_one({"username": request.username})
    
    if not user or not bcrypt.checkpw(request.password.encode('utf-8'), user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"]}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "username": user["username"],
            "role": user["role"],
            "permissions": user["permissions"]
        }
    }

@app.get("/api/form-config")
async def get_form_config(current_user = Depends(verify_token)):
    config = form_config_collection.find_one({})
    if not config:
        raise HTTPException(status_code=404, detail="Form configuration not found")
    
    # Remove MongoDB ObjectId for JSON serialization
    config["_id"] = str(config["_id"])
    return config

@app.post("/api/storage-records")
async def create_storage_record(record_data: dict, current_user = Depends(verify_token)):
    if "store" not in current_user["permissions"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Generate unique record ID
    record_id = str(uuid.uuid4())
    record_number = generate_next_record_id()
    
    # Get form configuration to validate fields
    form_config = form_config_collection.find_one({})
    if not form_config:
        raise HTTPException(status_code=500, detail="Form configuration not found")
    
    # Create storage record with dynamic fields
    storage_data = {
        "record_id": record_id,
        "record_number": record_number,
        "status": "Взята на хранение",
        "created_at": datetime.now(),
        "created_by": current_user["username"]
    }
    
    # Add all fields from form configuration
    for field in form_config.get("fields", []):
        field_name = field.get("name")
        field_value = record_data.get(field_name, "")
        
        # Validate required fields
        if field.get("required", False) and not field_value:
            raise HTTPException(status_code=400, detail=f"Required field missing: {field.get('label', field_name)}")
        
        storage_data[field_name] = field_value
    
    # Add any additional custom fields that were sent
    for key, value in record_data.items():
        if key not in storage_data and not key.startswith('_'):
            storage_data[key] = value
    
    result = storage_records_collection.insert_one(storage_data)
    
    # Return the created record
    storage_data["_id"] = str(result.inserted_id)
    storage_data["created_at"] = storage_data["created_at"].isoformat()
    
    return {
        "message": "Запись успешно создана",
        "record": storage_data
    }

@app.get("/api/storage-records/{record_id}")
async def get_storage_record(record_id: str, current_user = Depends(verify_token)):
    if "view" not in current_user["permissions"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    record = storage_records_collection.find_one({"record_id": record_id})
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    record["_id"] = str(record["_id"])
    record["created_at"] = record["created_at"].isoformat()
    
    # Add retail status text
    record["retail_status_text"] = retailcrm.get_retailcrm_status_text(record)
    
    return {"record": record}

@app.get("/api/storage-records")
async def get_storage_records(current_user = Depends(verify_token)):
    if "view" not in current_user["permissions"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    records = []
    # Sort by record_number in descending order (latest first)
    for record in storage_records_collection.find({}).sort("record_number", -1):
        record["_id"] = str(record["_id"])
        record["created_at"] = record["created_at"].isoformat()
        
        # Add retail status text
        record["retail_status_text"] = retailcrm.get_retailcrm_status_text(record)
        
        records.append(record)
    
    return {"records": records}

@app.get("/api/storage-records/search")
async def search_storage_records(
    query: str, 
    search_type: str,  # "record_number", "full_name", "phone"
    current_user = Depends(verify_token)
):
    if "release" not in current_user["permissions"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Search logic
    search_filter = {}
    if search_type == "record_number":
        try:
            search_filter["record_number"] = int(query)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid record number")
    elif search_type == "full_name":
        search_filter["full_name"] = {"$regex": query, "$options": "i"}
    elif search_type == "phone":
        search_filter["phone"] = {"$regex": query, "$options": "i"}
    else:
        raise HTTPException(status_code=400, detail="Invalid search type")
    
    # Return records that are in storage or new from retail
    search_filter["status"] = {"$in": ["Взята на хранение", "Новая"]}
    
    records = []
    for record in storage_records_collection.find(search_filter):
        record["_id"] = str(record["_id"])
        record["created_at"] = record["created_at"].isoformat()
        
        # Add retail status text
        record["retail_status_text"] = retailcrm.get_retailcrm_status_text(record)
        
        records.append(record)
    
    return {"records": records}

@app.put("/api/storage-records/{record_id}/take-storage")
async def take_to_storage(record_id: str, current_user = Depends(verify_token)):
    """Take record from 'Новая' to 'Взята на хранение' status"""
    if "store" not in current_user["permissions"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Find and update the record
    record = storage_records_collection.find_one({"record_id": record_id})
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    if record.get("status") != "Новая":
        raise HTTPException(status_code=400, detail="Can only take records with 'Новая' status")
    
    # Check if RetailCRM status allows this change
    retailcrm_status = record.get("retailcrm_status", "")
    if retailcrm_status and retailcrm_status == "товар на складе С/X":
        raise HTTPException(status_code=400, detail="Cannot change status - RetailCRM already shows 'товар на складе С/X'")
    
    # Update to storage status
    update_data = {
        "status": "Взята на хранение",
        "taken_to_storage_at": datetime.now(),
        "taken_to_storage_by": current_user["username"]
    }
    
    # Update RetailCRM status if order number exists and sync allowed
    retailcrm_order_number = record.get("retailcrm_order_number") or record.get("custom_field_1751496388330")
    if retailcrm_order_number and record.get("retailcrm_sync_count", 0) < 3:
        success = retailcrm.update_retailcrm_status(retailcrm_order_number, "товар на складе С/X")
        if success:
            update_data["retailcrm_status"] = "товар на складе С/X"
            update_data["retailcrm_sync_count"] = record.get("retailcrm_sync_count", 0) + 1
    
    result = storage_records_collection.update_one(
        {"record_id": record_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Record not found")
    
    return {"message": "Запись взята на хранение"}

@app.put("/api/storage-records/{record_id}/release")
async def release_storage_record(record_id: str, current_user = Depends(verify_token)):
    if "release" not in current_user["permissions"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Find the record first
    record = storage_records_collection.find_one({"record_id": record_id})
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    if record.get("status") != "Взята на хранение":
        raise HTTPException(status_code=400, detail="Record is not in storage")
    
    # Check if RetailCRM status allows this change
    retailcrm_status = record.get("retailcrm_status", "")
    if retailcrm_status and retailcrm_status == "выдан клиенту":
        raise HTTPException(status_code=400, detail="Cannot change status - RetailCRM already shows 'выдан клиенту'")
    
    # Update to released status
    update_data = {
        "status": "Выдана с хранения",
        "released_at": datetime.now(),
        "released_by": current_user["username"]
    }
    
    # Update RetailCRM status if order number exists and sync allowed
    retailcrm_order_number = record.get("retailcrm_order_number") or record.get("custom_field_1751496388330")
    if retailcrm_order_number and record.get("retailcrm_sync_count", 0) < 3:
        success = retailcrm.update_retailcrm_status(retailcrm_order_number, "выдан клиенту")
        if success:
            update_data["retailcrm_status"] = "выдан клиенту"
            update_data["retailcrm_sync_count"] = record.get("retailcrm_sync_count", 0) + 1
    
    result = storage_records_collection.update_one(
        {"record_id": record_id, "status": "Взята на хранение"},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Record not found or not in storage")
    
    return {"message": "Запись успешно выдана с хранения"}

@app.get("/api/storage-records/{record_id}/pdf")
async def generate_pdf_receipt(record_id: str, current_user = Depends(verify_token)):
    try:
        if "store" not in current_user["permissions"]:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Find the record
        record = storage_records_collection.find_one({"record_id": record_id})
        if not record:
            raise HTTPException(status_code=404, detail="Record not found")
        
        # Get PDF template
        template = pdf_template_collection.find_one({}) or {}
        template_text = template.get("template", "Я {full_name}, {phone}, оставил на хранение {parameters}, {size}, в Шинном Бюро по адресу {storage_location}. Подпись: _________________")
        
        # Create PDF
        buffer = io.BytesIO()
        p = canvas.Canvas(buffer, pagesize=A4)
        
        # Register Russian font (DejaVu Sans supports Cyrillic)
        font_registered = False
        try:
            from reportlab.pdfbase import pdfmetrics
            from reportlab.pdfbase.ttfonts import TTFont
            import os
            
            # Try to find and register DejaVu Sans font
            dejavu_paths = [
                '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
                '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
            ]
            
            # Register regular font
            if os.path.exists('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'):
                pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
                print("Registered DejaVuSans font")
                
            # Register bold font
            if os.path.exists('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'):
                pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
                print("Registered DejaVuSans-Bold font")
                
            font_registered = True
            print("Successfully registered DejaVu fonts for Cyrillic support")
                            
        except Exception as e:
            print(f"Font registration failed: {e}")
            font_registered = False
        
        # Page dimensions
        width, height = A4
        
        # Use default font but encode text properly
        # Set up fonts and colors
        p.setFont("Helvetica-Bold", 18)
        
        # Helper function to handle Cyrillic text
        def draw_cyrillic_text(canvas, x, y, text, font="Helvetica", size=12):
            # Use registered font if available, otherwise use default with encoding
            if font_registered and font.startswith("Helvetica"):
                # Replace Helvetica with DejaVu for Cyrillic support
                if "Bold" in font:
                    font_name = "DejaVuSans-Bold"
                else:
                    font_name = "DejaVuSans"
            else:
                font_name = font
            
            canvas.setFont(font_name, size)
            
            try:
                # Direct string drawing with proper font
                canvas.drawString(x, y, text)
            except Exception as e:
                # Fallback to transliteration if font fails
                print(f"Font drawing failed, using transliteration: {e}")
                canvas.setFont("Helvetica", size)
                
                # Simple transliteration mapping for Cyrillic
                cyrillic_to_latin = {
                    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
                    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
                    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
                    'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
                    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
                    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'YO',
                    'Ж': 'ZH', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
                    'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
                    'Ф': 'F', 'Х': 'H', 'Ц': 'TS', 'Ч': 'CH', 'Ш': 'SH', 'Щ': 'SCH',
                    'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'YU', 'Я': 'YA'
                }
                
                transliterated = ''.join(cyrillic_to_latin.get(char, char) for char in text)
                canvas.drawString(x, y, transliterated)
        
        # Format created_at date
        created_at_str = ""
        if record.get("created_at"):
            if isinstance(record["created_at"], datetime):
                created_at_str = record["created_at"].strftime("%d.%m.%Y")
            else:
                created_at_str = str(record["created_at"])
        
        # Format template with record data
        placeholders = {
            "full_name": record.get("full_name", ""),
            "phone": record.get("phone", ""),
            "parameters": record.get("parameters", ""),
            "size": record.get("size", ""),
            "storage_location": record.get("storage_location", ""),
            "record_number": str(record.get("record_number", "")),
            "record_id": record.get("record_id", ""),
            "created_at": created_at_str,
            "car_brand": record.get("car_brand", ""),
            "phone_additional": record.get("phone_additional", "") or "не указан"
        }
        
        formatted_template = template_text
        for key, value in placeholders.items():
            formatted_template = formatted_template.replace("{" + key + "}", str(value))
        
        # Draw the formatted template
        y_pos = height - 50
        lines = formatted_template.split('\n')
        
        for line in lines:
            if not line.strip():
                y_pos -= 15  # Empty line spacing
                continue
                
            # Check if line is a header (contains "АКТ ПРИЕМА")
            if "АКТ ПРИЕМА" in line:
                draw_cyrillic_text(p, 50, y_pos, line.strip(), "Helvetica-Bold", 16)
                y_pos -= 25
            # Check if line is a section header (contains numbers like "1.", "2.", etc.)
            elif line.strip().startswith(("1.", "2.", "3.", "4.")) and ":" in line:
                draw_cyrillic_text(p, 50, y_pos, line.strip(), "Helvetica-Bold", 12)
                y_pos -= 20
            # Check if line contains "ПОДПИСИ СТОРОН"
            elif "ПОДПИСИ СТОРОН" in line:
                draw_cyrillic_text(p, 50, y_pos, line.strip(), "Helvetica-Bold", 12)
                y_pos -= 30
            # Check if line is a field description (contains colons)
            elif ":" in line and not line.strip().startswith("http"):
                draw_cyrillic_text(p, 50, y_pos, line.strip(), "Helvetica", 11)
                y_pos -= 18
            # Regular text line
            else:
                # Handle long lines by wrapping them
                if len(line) > 85:
                    words = line.split(' ')
                    current_line = ""
                    for word in words:
                        if len(current_line + word) < 85:
                            current_line += word + " "
                        else:
                            if current_line:
                                draw_cyrillic_text(p, 50, y_pos, current_line.strip(), "Helvetica", 11)
                                y_pos -= 15
                            current_line = word + " "
                    if current_line:
                        draw_cyrillic_text(p, 50, y_pos, current_line.strip(), "Helvetica", 11)
                        y_pos -= 15
                else:
                    draw_cyrillic_text(p, 50, y_pos, line.strip(), "Helvetica", 11)
                    y_pos -= 15
        
        # Add signature lines if this is the signatures section
        if "Клиент:" in formatted_template and "Хранитель:" in formatted_template:
            y_pos -= 20
            # Draw signature lines
            p.line(50, y_pos, 250, y_pos)  # Client signature line
            p.line(350, y_pos, 550, y_pos)  # Storage signature line
            y_pos -= 15
            
            p.setFont("Helvetica", 9)
            draw_cyrillic_text(p, 50, y_pos, f"/ {record.get('full_name', '')} /", "Helvetica", 9)
            draw_cyrillic_text(p, 350, y_pos, f"/ {record.get('created_by', '')} /", "Helvetica", 9)
        
        # Footer
        y_pos = 50
        p.setFont("Helvetica", 8)
        p.setFillColor((0.5, 0.5, 0.5))
        draw_cyrillic_text(p, 50, y_pos, f"Документ создан: {datetime.now().strftime('%d.%m.%Y %H:%M')}", "Helvetica", 8)
        draw_cyrillic_text(p, 400, y_pos, f"ID записи: {record.get('record_id', '')}", "Helvetica", 8)
        
        p.save()
        buffer.seek(0)
        
        return StreamingResponse(
            io.BytesIO(buffer.read()),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=act_storage_{record.get('record_number', 'unknown')}.pdf",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET",
                "Access-Control-Allow-Headers": "*"
            }
        )
    except Exception as e:
        print(f"PDF generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")


@app.get("/api/storage-records/export")
async def export_storage_records(current_user = Depends(verify_token)):
    if "view" not in current_user["permissions"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Get all records
    records = []
    for record in storage_records_collection.find({}):
        # Convert ObjectId to string and datetime to ISO format
        record["_id"] = str(record["_id"])
        record["created_at"] = record["created_at"].isoformat()
        
        # Add retail status text
        record["retail_status_text"] = retailcrm.get_retailcrm_status_text(record)
        
        records.append(record)
    
    # Create DataFrame
    df = pd.DataFrame(records)
    
    # Reorder columns to put record_number first
    if not df.empty:
        cols = ['record_number'] + [col for col in df.columns if col != 'record_number']
        df = df[cols]
    
    # Create Excel file
    with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp_file:
        df.to_excel(tmp_file.name, index=False, engine='openpyxl')
        tmp_file_path = tmp_file.name
    
    return FileResponse(
        tmp_file_path,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename=f'storage_records_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
    )
@app.get("/api/storage-records/export/excel")
async def export_records_excel(current_user = Depends(verify_token)):
    if "view" not in current_user["permissions"] or current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Get all records
    records = []
    for record in storage_records_collection.find({}):
        records.append({
            "Номер": record.get("record_number", ""),
            "ФИО": record.get("full_name", ""),
            "Телефон": record.get("phone", ""),
            "Доп телефон": record.get("phone_additional", ""),
            "Марка машины": record.get("car_brand", ""),
            "Параметры": record.get("parameters", ""),
            "Размер": record.get("size", ""),
            "Место хранения": record.get("storage_location", ""),
            "Статус": record.get("status", ""),
            "Дата создания": record.get("created_at", datetime.now()).strftime("%d.%m.%Y %H:%M"),
            "Создал": record.get("created_by", ""),
            "Дата выдачи": record.get("released_at", datetime.now()).strftime("%d.%m.%Y %H:%M") if record.get("released_at") else "",
            "Выдал": record.get("released_by", "")
        })
    
    # Create Excel file
    df = pd.DataFrame(records)
    
    # Create temporary file
    with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp_file:
        df.to_excel(tmp_file.name, index=False)
        tmp_file_path = tmp_file.name
    
    return FileResponse(
        tmp_file_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=f"storage_records_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    )

@app.post("/api/storage-records/import")
async def import_storage_records(file: UploadFile = File(...), current_user = Depends(verify_token)):
    if "view" not in current_user["permissions"] or current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files are supported")
    
    try:
        # Read Excel file
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        imported_count = 0
        duplicate_count = 0
        error_count = 0
        errors = []
        
        # Get existing record numbers to check for duplicates
        existing_record_numbers = set(
            record.get("record_number") for record in storage_records_collection.find({}, {"record_number": 1})
            if record.get("record_number") is not None
        )
        
        for index, row in df.iterrows():
            try:
                # Check for duplicate record number
                if pd.notna(row.get('record_number')) and int(row['record_number']) in existing_record_numbers:
                    duplicate_count += 1
                    continue
                
                # Create record
                record_data = {
                    "record_id": str(uuid.uuid4()),
                    "record_number": generate_next_record_id(),  # Generate new number regardless of import data
                    "status": "Взята на хранение",
                    "created_at": datetime.now(),
                    "created_by": f"{current_user['username']}_import"
                }
                
                # Map DataFrame columns to record fields
                for col in df.columns:
                    if col not in ['_id', 'record_id', 'record_number', 'created_at', 'created_by']:
                        value = row[col]
                        if pd.notna(value):
                            record_data[col] = str(value)
                
                # Validate required fields
                required_fields = ['full_name', 'phone']
                for field in required_fields:
                    if not record_data.get(field):
                        raise ValueError(f"Missing required field: {field}")
                
                storage_records_collection.insert_one(record_data)
                imported_count += 1
                
            except Exception as e:
                error_count += 1
                errors.append(f"Row {index + 1}: {str(e)}")
                if len(errors) > 10:  # Limit error messages
                    errors.append(f"... и еще {len(df) - index - 1} ошибок")
                    break
        
        return {
            "message": "Импорт завершен",
            "imported": imported_count,
            "duplicates": duplicate_count,
            "errors": error_count,
            "error_details": errors[:10]  # Show first 10 errors
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

@app.post("/api/storage-records/import/excel")
async def import_records_excel(file: UploadFile = File(...), current_user = Depends(verify_token)):
    if "store" not in current_user["permissions"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Read Excel file
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        # Validate required columns
        required_columns = ["ФИО", "Телефон", "Марка машины", "Параметры", "Размер", "Место хранения"]
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            raise HTTPException(status_code=400, detail=f"Missing columns: {', '.join(missing_columns)}")
        
        # Import records
        imported_count = 0
        for _, row in df.iterrows():
            record_id = str(uuid.uuid4())
            record_number = generate_next_record_id()
            
            storage_data = {
                "record_id": record_id,
                "record_number": record_number,
                "full_name": str(row.get("ФИО", "")),
                "phone": str(row.get("Телефон", "")),
                "phone_additional": str(row.get("Доп телефон", "")),
                "car_brand": str(row.get("Марка машины", "")),
                "parameters": str(row.get("Параметры", "")),
                "size": str(row.get("Размер", "")),
                "storage_location": str(row.get("Место хранения", "")),
                "status": "Взята на хранение",
                "created_at": datetime.now(),
                "created_by": current_user["username"]
            }
            
            storage_records_collection.insert_one(storage_data)
            imported_count += 1
        
        return {"message": f"Успешно импортировано {imported_count} записей"}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Import error: {str(e)}")

@app.get("/api/users")
async def get_users(current_user = Depends(verify_token)):
    if "user_management" not in current_user["permissions"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    users = []
    for user in users_collection.find({}):
        users.append({
            "username": user["username"],
            "role": user["role"],
            "permissions": user["permissions"]
        })
    
    return {"users": users}

@app.post("/api/users")
async def create_user(user_data: dict, current_user = Depends(verify_token)):
    if "user_management" not in current_user["permissions"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    username = user_data.get("username")
    password = user_data.get("password")
    role = user_data.get("role", "user")
    permissions = user_data.get("permissions", ["store", "view"])
    
    # Check if user already exists
    if users_collection.find_one({"username": username}):
        raise HTTPException(status_code=400, detail="User already exists")
    
    # Hash password
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    
    # Create user
    user_doc = {
        "username": username,
        "password": hashed_password,
        "role": role,
        "permissions": permissions
    }
    
    users_collection.insert_one(user_doc)
    
    return {"message": "User created successfully"}

@app.put("/api/users/{username}")
async def update_user_permissions(username: str, permissions_data: dict, current_user = Depends(verify_token)):
    if "user_management" not in current_user["permissions"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Don't allow modifying admin user
    if username == "admin":
        raise HTTPException(status_code=400, detail="Cannot modify admin user")
    
    permissions = permissions_data.get("permissions", [])
    
    result = users_collection.update_one(
        {"username": username},
        {"$set": {"permissions": permissions}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User permissions updated successfully"}

@app.delete("/api/users/{username}")
async def delete_user(username: str, current_user = Depends(verify_token)):
    if "user_management" not in current_user["permissions"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Don't allow deleting admin user
    if username == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete admin user")
    
    result = users_collection.delete_one({"username": username})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User deleted successfully"}

@app.put("/api/form-config")
async def update_form_config(config_data: dict, current_user = Depends(verify_token)):
    if "form_management" not in current_user["permissions"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    fields = config_data.get("fields", [])
    
    # Validate that required system fields are present
    system_fields = ["record_id", "record_number", "status", "created_at", "created_by"]
    
    result = form_config_collection.update_one(
        {},
        {"$set": {"fields": fields}},
        upsert=True
    )
    
    return {"message": "Form configuration updated successfully"}

@app.get("/api/pdf-template")
async def get_pdf_template(current_user = Depends(verify_token)):
    if "pdf_management" not in current_user["permissions"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    template = pdf_template_collection.find_one({})
    if not template:
        # Return default template
        return {"template": "Я {full_name}, {phone}, оставил на хранение {parameters}, {size}, в Шинном Бюро по адресу {storage_location}, номер акта {record_number} {created_at}. Подпись: _________________"}
    
    return {"template": template.get("template", "")}

@app.put("/api/pdf-template")
async def update_pdf_template(template_data: dict, current_user = Depends(verify_token)):
    if "pdf_management" not in current_user["permissions"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    template = template_data.get("template", "")
    
    result = pdf_template_collection.update_one(
        {},
        {"$set": {"template": template}},
        upsert=True
    )
    
    return {"message": "PDF template updated successfully"}

@app.delete("/api/storage-records/bulk")
async def bulk_delete_records(record_ids: List[str], current_user = Depends(verify_token)):
    if "delete_records" not in current_user["permissions"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    if not record_ids:
        raise HTTPException(status_code=400, detail="No record IDs provided")
    
    try:
        # Delete records by IDs
        result = storage_records_collection.delete_many({"record_id": {"$in": record_ids}})
        
        return {
            "message": f"Удалено {result.deleted_count} записей",
            "deleted_count": result.deleted_count
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete records: {str(e)}")

@app.delete("/api/storage-records/{record_id}")
async def delete_storage_record(record_id: str, current_user = Depends(verify_token)):
    if "delete_records" not in current_user["permissions"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Find and delete the record
    result = storage_records_collection.delete_one({"record_id": record_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Record not found")
    
    return {"message": "Запись успешно удалена"}

@app.get("/api/retailcrm/orders")
async def get_retailcrm_orders(current_user = Depends(verify_token)):
    if "view" not in current_user["permissions"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    orders = []
    for order in storage_records_collection.find({"source": "retailcrm"}):
        order["_id"] = str(order["_id"])
        order["created_at"] = order["created_at"].isoformat()
        orders.append(order)
    
    return {"orders": orders}

@app.post("/api/retailcrm/sync")
async def manual_retailcrm_sync(current_user = Depends(verify_token)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admin can trigger manual sync")
    
    try:
        retailcrm.fetch_orders()
        return {"message": "Manual RetailCRM sync completed successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")

@app.get("/api/retailcrm/status")
async def get_retailcrm_status(current_user = Depends(verify_token)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admin can view sync status")
    
    return {
        "scheduler_running": retailcrm.scheduler.running,
        "api_url": RETAILCRM_API_URL,
        "last_sync_orders": storage_records_collection.count_documents({"source": "retailcrm"})
    }

# Calculator API endpoints
@app.get("/api/calculator/settings/{vehicle_type}")
async def get_calculator_settings(vehicle_type: str):
    """Get calculator settings for specific vehicle type (public endpoint)"""
    settings = calculator_settings_collection.find_one({"vehicle_type": vehicle_type})
    if not settings:
        raise HTTPException(status_code=404, detail="Vehicle type not found")
    
    # Remove MongoDB _id field
    settings.pop('_id', None)
    return settings

@app.post("/api/calculator/calculate")
async def calculate_service_cost(request: CalculatorRequest):
    """Calculate total cost and time for selected services (public endpoint)"""
    # Get settings for vehicle type
    settings = calculator_settings_collection.find_one({"vehicle_type": request.vehicle_type})
    if not settings:
        raise HTTPException(status_code=400, detail="Invalid vehicle type")
    
    total_time = 0
    total_cost = 0
    breakdown = {
        "services": [],
        "additional_options": [],
        "base_time": 0,
        "multiplier": 1.0,
        "final_time": 0,
        "hourly_rate": settings["hourly_rate"]
    }
    
    # Calculate time for selected services
    for service_id in request.selected_services:
        service = next((s for s in settings["services"] if s["id"] == service_id and s["enabled"]), None)
        if service:
            time_for_size = service["time_by_size"].get(request.tire_size, 0)
            service_time = time_for_size * request.wheel_count
            total_time += service_time
            
            breakdown["services"].append({
                "id": service_id,
                "name": service["name"],
                "time_per_wheel": time_for_size,
                "total_time": service_time
            })
    
    breakdown["base_time"] = total_time
    
    # Apply additional options multipliers
    multiplier = 1.0
    for option_id in request.additional_options:
        option = next((o for o in settings["additional_options"] if o["id"] == option_id), None)
        if option:
            multiplier *= option["time_multiplier"]
            breakdown["additional_options"].append({
                "id": option_id,
                "name": option["name"],
                "multiplier": option["time_multiplier"]
            })
    
    breakdown["multiplier"] = multiplier
    final_time = int(total_time * multiplier)
    breakdown["final_time"] = final_time
    
    # Calculate cost (time in minutes to hours)
    total_cost = int((final_time / 60) * settings["hourly_rate"])
    
    result = {
        "vehicle_type": request.vehicle_type,
        "tire_size": request.tire_size,
        "wheel_count": request.wheel_count,
        "selected_services": request.selected_services,
        "additional_options": request.additional_options,
        "total_time": final_time,
        "total_cost": total_cost,
        "breakdown": breakdown
    }
    
    return result

@app.post("/api/calculator/save-result")
async def save_calculator_result(request: CalculatorRequest):
    """Save calculation result and return unique link (public endpoint)"""
    # Calculate the result first
    calculation = await calculate_service_cost(request)
    
    # Generate short unique ID
    # Find the highest existing number
    existing_results = calculator_results_collection.find({}, {"short_id": 1}).sort("short_id", -1).limit(1)
    highest_num = 0
    for result in existing_results:
        short_id = result.get("short_id", "rez0")
        if short_id.startswith("rez"):
            try:
                highest_num = int(short_id[3:])
            except:
                pass
    
    # Generate next ID
    next_num = highest_num + 1
    short_id = f"rez{next_num}"
    
    # Set expiration date (1 week from now)
    from datetime import timedelta
    expires_at = datetime.now() + timedelta(weeks=1)
    
    # Save to database
    result_doc = {
        "short_id": short_id,
        "unique_id": str(uuid.uuid4()),  # Keep UUID for internal use
        "calculation": calculation,
        "created_at": datetime.now(),
        "expires_at": expires_at
    }
    
    calculator_results_collection.insert_one(result_doc)
    
    return {"short_id": short_id, "calculation": calculation}

@app.get("/api/calculator/result/{short_id}")
async def get_calculator_result(short_id: str):
    """Get saved calculation result by short ID (public endpoint)"""
    result = calculator_results_collection.find_one({"short_id": short_id})
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    
    # Check if result has expired
    if "expires_at" in result and result["expires_at"] < datetime.now():
        raise HTTPException(status_code=410, detail="Result has expired")
    
    # Remove MongoDB _id field
    result.pop('_id', None)
    return result

# Admin endpoints for calculator management
@app.get("/api/admin/calculator/settings")
async def get_all_calculator_settings(current_user = Depends(verify_token)):
    """Get all calculator settings (admin only)"""
    if "calculator_management" not in current_user["permissions"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    settings = list(calculator_settings_collection.find())
    for setting in settings:
        setting.pop('_id', None)
    
    return settings

@app.put("/api/admin/calculator/settings/{vehicle_type}")
async def update_calculator_settings(vehicle_type: str, settings_data: dict, current_user = Depends(verify_token)):
    """Update calculator settings for vehicle type (admin only)"""
    if "calculator_management" not in current_user["permissions"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    result = calculator_settings_collection.update_one(
        {"vehicle_type": vehicle_type},
        {"$set": settings_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vehicle type not found")
    
    return {"message": "Settings updated successfully"}

@app.get("/api/admin/calculator/results")
async def get_calculator_results(current_user = Depends(verify_token)):
    """Get all saved calculator results (admin only)"""
    if "calculator_management" not in current_user["permissions"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    results = list(calculator_results_collection.find().sort("created_at", -1).limit(100))
    for result in results:
        result.pop('_id', None)
    
    return results

# Initialize default data on startup
init_default_data()

# Start RetailCRM scheduler (reduced frequency to 1 hour to avoid server overload)
try:
    retailcrm.start_scheduler()
except Exception as e:
    logger.error(f"Failed to start RetailCRM scheduler: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)