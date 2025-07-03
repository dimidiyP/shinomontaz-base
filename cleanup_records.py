#!/usr/bin/env python3

import pymongo
import os

# Connect to MongoDB
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = pymongo.MongoClient(mongo_url)
db = client.tire_storage
storage_records_collection = db.storage_records

# Get total count
total_count = storage_records_collection.count_documents({})
print(f"Всего записей в базе: {total_count}")

if total_count <= 3:
    print("В базе уже 3 или меньше записей. Очистка не требуется.")
    exit(0)

# Keep only the first 3 records (oldest by creation)
records_to_keep = list(storage_records_collection.find().sort("created_at", 1).limit(3))
print(f"Оставляем 3 самые старые записи:")
for record in records_to_keep:
    print(f"  - Запись #{record['record_number']}: {record['full_name']} ({record['created_at']})")

# Get IDs of records to keep
keep_ids = [record['_id'] for record in records_to_keep]

# Delete all other records
delete_result = storage_records_collection.delete_many({"_id": {"$nin": keep_ids}})
print(f"Удалено записей: {delete_result.deleted_count}")

# Verify the result
remaining_count = storage_records_collection.count_documents({})
print(f"Записей осталось в базе: {remaining_count}")

if remaining_count == 3:
    print("✅ Очистка выполнена успешно!")
else:
    print("❌ Ошибка: количество записей не соответствует ожидаемому.")