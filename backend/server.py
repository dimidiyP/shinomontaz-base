from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import os
from pymongo import MongoClient
import uuid
from datetime import datetime
import bcrypt
from jose import JWTError, jwt
from datetime import timedelta

# Configuration
SECRET_KEY = "your-secret-key-here"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

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
                "permissions": ["store", "release", "view", "form_management", "pdf_management", "user_management"]
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
    full_name: str
    phone: str
    phone_additional: Optional[str] = None
    car_brand: str
    parameters: str
    size: str
    storage_location: str

class User(BaseModel):
    username: str
    role: str
    permissions: List[str]

# Utility functions
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
async def create_storage_record(record: StorageRecord, current_user = Depends(verify_token)):
    if "store" not in current_user["permissions"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Generate unique record ID
    record_id = str(uuid.uuid4())
    record_number = generate_next_record_id()
    
    # Create storage record
    storage_data = {
        "record_id": record_id,
        "record_number": record_number,
        "full_name": record.full_name,
        "phone": record.phone,
        "phone_additional": record.phone_additional,
        "car_brand": record.car_brand,
        "parameters": record.parameters,
        "size": record.size,
        "storage_location": record.storage_location,
        "status": "Взята на хранение",
        "created_at": datetime.now(),
        "created_by": current_user["username"]
    }
    
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

# Initialize default data on startup
init_default_data()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)