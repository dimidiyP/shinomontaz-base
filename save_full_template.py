#!/usr/bin/env python3

import pymongo
import os

# Connect to MongoDB
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = pymongo.MongoClient(mongo_url)
db = client.tire_storage
pdf_template_collection = db.pdf_template

# Define the full template as seen in the generated PDF
full_template = """АКТ ПРИЕМА НА ХРАНЕНИЕ № {record_number}
г. Нижний Новгород                                  "{created_at}"

Мы, нижеподписавшиеся:
1. {full_name}, именуемый в дальнейшем "Клиент",
2. ООО Ритейл, именуемый в дальнейшем "Хранитель",

составили настоящий акт о нижеследующем:

1. ПРЕДМЕТ АКТА:
Клиент передает, а Хранитель принимает на хранение автомобильные шины
в количестве и на условиях, указанных ниже.

2. ИНФОРМАЦИЯ О ТОВАРЕ:
Параметры шин:     {parameters}
Количество:        {size}
Автомобиль:        {car_brand}
Телефон клиента:   {phone}
Доп. телефон:      {phone_additional}

3. УСЛОВИЯ ХРАНЕНИЯ:
Место хранения: {storage_location}
Срок хранения: согласно договору
Дата приема: {created_at}

4. ДОПОЛНИТЕЛЬНЫЕ УСЛОВИЯ:
ТЕСТ: Акт №{record_number} для {full_name}, телефон {phone}

ПОДПИСИ СТОРОН:

Клиент:                                           Хранитель:"""

print(f"Сохраняем полный шаблон в базу данных...")

# Update the template in database
result = pdf_template_collection.update_one(
    {},
    {"$set": {"template": full_template}},
    upsert=True
)

if result.modified_count > 0 or result.upserted_id:
    print("✅ Шаблон успешно сохранен в базу данных!")
else:
    print("❌ Ошибка при сохранении шаблона")

# Verify the template was saved
template = pdf_template_collection.find_one({})
if template:
    print(f"✅ Проверка: шаблон найден в базе данных (длина: {len(template['template'])} символов)")
    print("📄 Начало шаблона:")
    print(template['template'][:200] + "...")
else:
    print("❌ Шаблон не найден в базе данных!")