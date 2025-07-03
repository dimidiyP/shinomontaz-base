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

# Security scheme
security = HTTPBearer()

# Initialize default users and data
def init_default_data():
    # Create default users if they don't exist
    if users_collection.count_documents({}) == 0:
        admin_password = bcrypt.hashpw("K2enlzuzz2".encode('utf-8'), bcrypt.gensalt())
        user_password = bcrypt.hashpw("user".encode('utf-8'), bcrypt.gensalt())
        
        users_collection.insert_many([
            {
                "username": "admin",
                "password": admin_password,
                "role": "admin",
                "permissions": ["store", "release", "view", "form_management", "pdf_management", "user_management", "delete_records"]
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

# RetailCRM Integration Class
class RetailCRMIntegration:
    def __init__(self):
        self.api_url = RETAILCRM_API_URL
        self.api_key = RETAILCRM_API_KEY
        self.scheduler = BackgroundScheduler()
        
    def fetch_orders(self):
        """Fetch orders from RetailCRM API v5 with chranenie = 1"""
        try:
            url = f"{self.api_url}/api/v5/orders"
            headers = {
                'X-API-KEY': self.api_key,
                'Content-Type': 'application/json'
            }
            
            # Filter orders where custom field 'chranenie' = 1
            params = {
                'filter[customFields][chranenie]': '1',
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
                # Create a storage record format compatible entry
                storage_record = {
                    "record_id": str(uuid.uuid4()),
                    "record_number": self.generate_next_record_id(),
                    "full_name": self.extract_full_name(order),
                    "phone": self.extract_phone(order),
                    "phone_additional": "",
                    "car_brand": "",  # Will be filled from order data if available
                    "parameters": self.extract_parameters(order),
                    "size": self.extract_size(order),
                    "storage_location": self.extract_storage_location(order),
                    "status": "Взята на хранение",
                    "created_at": datetime.now(),
                    "created_by": "retailcrm_sync",
                    "custom_field_1751496388330": order.get('number', ''),
                    "retailcrm_order_id": order.get('id'),
                    "retailcrm_external_id": order.get('externalId'),
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
        """Extract storage location from delivery address"""
        if 'delivery' in order and 'address' in order['delivery']:
            return order['delivery']['address'].get('text', 'Не указано')
        return "Не указано"
    
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
        for order in orders:
            # Check if order already exists by retailcrm_order_id
            existing = storage_records_collection.find_one({
                "retailcrm_order_id": order.get("retailcrm_order_id")
            })
            
            if not existing:
                storage_records_collection.insert_one(order)
                logger.info(f"Saved new order from RetailCRM: {order.get('custom_field_1751496388330')}")
            else:
                logger.debug(f"Order already exists: {order.get('custom_field_1751496388330')}")
    
    def start_scheduler(self):
        """Start the background scheduler"""
        self.scheduler.add_job(
            self.fetch_orders,
            'interval',
            minutes=5,  # Every 5 minutes as requested
            id='retailcrm_sync'
        )
        self.scheduler.start()
        logger.info("RetailCRM scheduler started - running every 5 minutes")
    
    def stop_scheduler(self):
        """Stop the scheduler"""
        if self.scheduler.running:
            self.scheduler.shutdown()
            logger.info("RetailCRM scheduler stopped")

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

@app.get("/api/storage-records")
async def get_storage_records(current_user = Depends(verify_token)):
    if "view" not in current_user["permissions"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    records = []
    for record in storage_records_collection.find({}):
        record["_id"] = str(record["_id"])
        record["created_at"] = record["created_at"].isoformat()
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
    
    # Only return records that are in storage
    search_filter["status"] = "Взята на хранение"
    
    records = []
    for record in storage_records_collection.find(search_filter):
        record["_id"] = str(record["_id"])
        record["created_at"] = record["created_at"].isoformat()
        records.append(record)
    
    return {"records": records}

@app.put("/api/storage-records/{record_id}/release")
async def release_storage_record(record_id: str, current_user = Depends(verify_token)):
    if "release" not in current_user["permissions"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Find and update the record
    result = storage_records_collection.update_one(
        {"record_id": record_id, "status": "Взята на хранение"},
        {
            "$set": {
                "status": "Выдана с хранения",
                "released_at": datetime.now(),
                "released_by": current_user["username"]
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Record not found or already released")
    
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
        template_text = template.get("template", "Я {full_name}, {phone}, оставил на хранение {parameters}, {size}, в Шинном Бюро по адресу {storage_location}, номер акта {record_number} {created_at}. Подпись: _________________")
        
        # Create PDF
        buffer = io.BytesIO()
        p = canvas.Canvas(buffer, pagesize=A4)
        
        # Set up font (using default font for now)
        p.setFont("Helvetica", 12)
        
        # Title
        p.setFont("Helvetica-Bold", 16)
        p.drawString(50, 750, "AKT PRIEMA NA HRANENIE")
        
        # Content
        p.setFont("Helvetica", 12)
        y_position = 700
        
        # Format template with record data - handle datetime properly
        created_at_str = ""
        if record.get("created_at"):
            if isinstance(record["created_at"], datetime):
                created_at_str = record["created_at"].strftime("%d.%m.%Y %H:%M")
            else:
                created_at_str = str(record["created_at"])
        
        # Use a dictionary for string formatting to avoid positional argument issues
        format_dict = {
            "full_name": record.get("full_name", ""),
            "phone": record.get("phone", ""),
            "parameters": record.get("parameters", ""),
            "size": record.get("size", ""),
            "storage_location": record.get("storage_location", ""),
            "record_number": record.get("record_number", ""),
            "record_id": record.get("record_id", ""),
            "created_at": created_at_str,
            "car_brand": record.get("car_brand", ""),
            "phone_additional": record.get("phone_additional", "")
        }
        
        # Use named placeholders for string formatting
        formatted_text = template_text
        for key, value in format_dict.items():
            formatted_text = formatted_text.replace("{" + key + "}", str(value))
        
        # Split text into lines and draw
        lines = formatted_text.split('\n')
        for line in lines:
            if len(line) > 80:  # Wrap long lines
                words = line.split(' ')
                current_line = ""
                for word in words:
                    if len(current_line + word) < 80:
                        current_line += word + " "
                    else:
                        p.drawString(50, y_position, current_line.strip())
                        y_position -= 20
                        current_line = word + " "
                if current_line:
                    p.drawString(50, y_position, current_line.strip())
                    y_position -= 20
            else:
                p.drawString(50, y_position, line)
                y_position -= 20
        
        # Additional info
        y_position -= 20
        p.drawString(50, y_position, f"Data: {created_at_str}")
        y_position -= 20
        p.drawString(50, y_position, f"Sotrudnik: {record.get('created_by', '')}")
        
        # Signature line
        y_position -= 40
        p.drawString(50, y_position, "Podpis klienta: _________________________")
        y_position -= 30
        p.drawString(50, y_position, "Podpis sotrudnika: _________________________")
        
        p.save()
        buffer.seek(0)
        
        return StreamingResponse(
            io.BytesIO(buffer.read()),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=act_{record_id}.pdf",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET",
                "Access-Control-Allow-Headers": "*"
            }
        )
    except Exception as e:
        print(f"PDF generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

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

# Initialize default data on startup
init_default_data()

# Start RetailCRM scheduler
try:
    retailcrm.start_scheduler()
except Exception as e:
    logger.error(f"Failed to start RetailCRM scheduler: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)