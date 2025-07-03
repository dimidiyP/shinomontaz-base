import os
from pymongo import MongoClient

# Connect to MongoDB
client = MongoClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
db = client[os.environ.get('DB_NAME', 'tire_storage')]

# Get admin user
admin = db.users.find_one({'username': 'admin'})
print("Before update:", admin['permissions'])

# Add delete_records permission if not already present
if 'delete_records' not in admin['permissions']:
    admin['permissions'].append('delete_records')
    
    # Update the user
    db.users.replace_one({'username': 'admin'}, admin)
    print("Permission added")
else:
    print("Permission already exists")

# Verify the update
admin = db.users.find_one({'username': 'admin'})
print("After update:", admin['permissions'])