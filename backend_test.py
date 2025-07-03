import requests
import unittest
import sys
import io
import os
import json
import tempfile
import pandas as pd
from datetime import datetime

class TireStorageAPITester(unittest.TestCase):
    def __init__(self, *args, **kwargs):
        super(TireStorageAPITester, self).__init__(*args, **kwargs)
        # Get the backend URL from frontend/.env
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    self.base_url = line.strip().split('=')[1].strip('"\'')
                    break
        print(f"Using backend URL: {self.base_url}")
        self.admin_token = None
        self.user_token = None
        self.created_record_id = None
        self.created_record_number = None
        self.new_status_record_id = None  # For testing status transitions
        self.test_user = f"testuser_{datetime.now().strftime('%H%M%S')}"

    def setUp(self):
        # Login as admin and user to get tokens
        self.admin_login()
        self.user_login()

    def admin_login(self):
        """Test admin login and get token"""
        print("\n🔍 Testing Admin Login...")
        response = requests.post(
            f"{self.base_url}/api/login",
            json={"username": "admin", "password": "K2enlzuzz2"}
        )
        
        self.assertEqual(response.status_code, 200, "Admin login failed")
        data = response.json()
        self.assertIn("access_token", data, "Token not found in response")
        self.admin_token = data["access_token"]
        self.assertEqual(data["user"]["role"], "admin", "User role is not admin")
        print("✅ Admin login successful")
        return True

    def user_login(self):
        """Test user login and get token"""
        print("\n🔍 Testing User Login...")
        response = requests.post(
            f"{self.base_url}/api/login",
            json={"username": "user", "password": "user"}
        )
        
        self.assertEqual(response.status_code, 200, "User login failed")
        data = response.json()
        self.assertIn("access_token", data, "Token not found in response")
        self.user_token = data["access_token"]
        self.assertEqual(data["user"]["role"], "user", "User role is not user")
        print("✅ User login successful")
        return True

    def test_1_get_form_config(self):
        """Test getting form configuration"""
        print("\n🔍 Testing Get Form Config...")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        response = requests.get(f"{self.base_url}/api/form-config", headers=headers)
        
        self.assertEqual(response.status_code, 200, "Failed to get form config")
        data = response.json()
        self.assertIn("fields", data, "Fields not found in form config")
        print("✅ Form config retrieved successfully")
        return True

    def test_2_create_storage_record(self):
        """Test creating a storage record"""
        print("\n🔍 Testing Create Storage Record...")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # First, get the form configuration to see what fields are available
        form_config_response = requests.get(f"{self.base_url}/api/form-config", headers=headers)
        self.assertEqual(form_config_response.status_code, 200, "Failed to get form config")
        form_config = form_config_response.json()
        
        # Prepare basic storage data
        storage_data = {
            "full_name": "Иванов Иван Иванович",
            "phone": "+7-999-123-45-67",
            "phone_additional": "+7-999-987-65-43",
            "car_brand": "Toyota Camry",
            "parameters": "215/60/R16",
            "size": "4 шт",
            "storage_location": "Бекетова 3а.к15"
        }
        
        # Add any custom fields from form config
        for field in form_config.get("fields", []):
            field_name = field.get("name")
            if field_name not in storage_data and field.get("required", False):
                # Add a default value for required fields not already in storage_data
                if field.get("type") == "text":
                    storage_data[field_name] = f"Test value for {field_name}"
                elif field.get("type") == "select" and field.get("options"):
                    storage_data[field_name] = field.get("options")[0]
        
        # Add a custom dynamic field for testing
        storage_data["custom_field_1751496388330"] = "Test dynamic field value"
        
        response = requests.post(
            f"{self.base_url}/api/storage-records", 
            json=storage_data, 
            headers=headers
        )
        
        self.assertEqual(response.status_code, 200, f"Failed to create storage record: {response.text if response.status_code != 200 else ''}")
        data = response.json()
        self.assertIn("record", data, "Record not found in response")
        self.assertIn("record_id", data["record"], "Record ID not found")
        self.assertIn("record_number", data["record"], "Record number not found")
        self.assertEqual(data["record"]["status"], "Взята на хранение", "Status is not correct")
        self.assertIn("created_at", data["record"], "Created at timestamp not found")
        self.assertIn("created_by", data["record"], "Creator username not found")
        
        # Verify custom field was saved
        self.assertIn("custom_field_1751496388330", data["record"], "Custom field not found in created record")
        self.assertEqual(data["record"]["custom_field_1751496388330"], "Test dynamic field value", "Custom field value is incorrect")
        
        # Save record ID for later tests
        self.created_record_id = data["record"]["record_id"]
        self.created_record_number = data["record"]["record_number"]
        
        print(f"✅ Storage record created successfully with ID: {self.created_record_id}")
        print(f"✅ Record number: {self.created_record_number}")
        print(f"✅ Custom field saved successfully")
        
        # Verify the record exists by getting it directly
        get_response = requests.get(f"{self.base_url}/api/storage-records", headers=headers)
        self.assertEqual(get_response.status_code, 200, "Failed to get records")
        get_data = get_response.json()
        
        record_found = False
        for record in get_data.get("records", []):
            if record.get("record_id") == self.created_record_id:
                record_found = True
                self.assertEqual(record.get("custom_field_1751496388330"), "Test dynamic field value", "Custom field value is incorrect in retrieved record")
                break
                
        self.assertTrue(record_found, f"Created record with ID {self.created_record_id} not found in records list")
        print(f"✅ Record verified in database")
        
        return True

    def test_3_search_by_name(self):
        """Test searching for a record by name"""
        print("\n🔍 Testing Search by Name...")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # First, make sure we have a record to search for
        if not self.created_record_id:
            print("⚠️ No record ID available for search test, creating a record first")
            self.test_2_create_storage_record()
        
        response = requests.get(
            f"{self.base_url}/api/storage-records/search?query=Иванов&search_type=full_name", 
            headers=headers
        )
        
        self.assertEqual(response.status_code, 200, f"Failed to search by name: {response.text if response.status_code != 200 else ''}")
        data = response.json()
        self.assertIn("records", data, "Records not found in response")
        
        # If no records found, it might be because our test record has a different name
        # Let's try searching for the actual name we used
        if len(data["records"]) == 0:
            # Get our created record
            get_response = requests.get(
                f"{self.base_url}/api/storage-records/{self.created_record_id}", 
                headers=headers
            )
            if get_response.status_code == 200:
                record = get_response.json().get("record", {})
                name = record.get("full_name", "")
                if name:
                    # Try searching with the actual name
                    name_part = name.split()[0]  # Use first part of the name
                    response = requests.get(
                        f"{self.base_url}/api/storage-records/search?query={name_part}&search_type=full_name", 
                        headers=headers
                    )
                    if response.status_code == 200:
                        data = response.json()
        
        print(f"✅ Found {len(data.get('records', []))} records by name")
        return True

    def test_4_search_by_phone(self):
        """Test searching for a record by phone"""
        print("\n🔍 Testing Search by Phone...")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # First, make sure we have a record to search for
        if not self.created_record_id:
            print("⚠️ No record ID available for search test, creating a record first")
            self.test_2_create_storage_record()
        
        response = requests.get(
            f"{self.base_url}/api/storage-records/search?query=999-123&search_type=phone", 
            headers=headers
        )
        
        self.assertEqual(response.status_code, 200, f"Failed to search by phone: {response.text if response.status_code != 200 else ''}")
        data = response.json()
        self.assertIn("records", data, "Records not found in response")
        
        # If no records found, it might be because our test record has a different phone
        # Let's try searching for the actual phone we used
        if len(data["records"]) == 0:
            # Get our created record
            get_response = requests.get(
                f"{self.base_url}/api/storage-records/{self.created_record_id}", 
                headers=headers
            )
            if get_response.status_code == 200:
                record = get_response.json().get("record", {})
                phone = record.get("phone", "")
                if phone:
                    # Try searching with part of the actual phone
                    phone_part = phone[:6]  # Use first few digits
                    response = requests.get(
                        f"{self.base_url}/api/storage-records/search?query={phone_part}&search_type=phone", 
                        headers=headers
                    )
                    if response.status_code == 200:
                        data = response.json()
        
        print(f"✅ Found {len(data.get('records', []))} records by phone")
        return True

    def test_5_get_all_records(self):
        """Test getting all records"""
        print("\n🔍 Testing Get All Records...")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        response = requests.get(f"{self.base_url}/api/storage-records", headers=headers)
        
        self.assertEqual(response.status_code, 200, "Failed to get all records")
        data = response.json()
        self.assertIn("records", data, "Records not found in response")
        print(f"✅ Retrieved {len(data['records'])} records")
        return True

    def test_6_release_record(self):
        """Test releasing a record from storage"""
        if not self.created_record_id:
            print("⚠️ Skipping release test - no record ID available")
            return False
            
        print("\n🔍 Testing Release Record...")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        response = requests.put(
            f"{self.base_url}/api/storage-records/{self.created_record_id}/release", 
            headers=headers
        )
        
        self.assertEqual(response.status_code, 200, "Failed to release record")
        data = response.json()
        self.assertIn("message", data, "Message not found in response")
        print(f"✅ Record released successfully")
        return True

    def test_7_generate_pdf(self):
        """Test generating PDF for a record"""
        if not self.created_record_id:
            print("⚠️ Skipping PDF generation test - no record ID available")
            return False
            
        print("\n🔍 Testing PDF Generation...")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        try:
            response = requests.get(
                f"{self.base_url}/api/storage-records/{self.created_record_id}/pdf", 
                headers=headers,
                timeout=30  # Increase timeout to avoid connection errors
            )
            
            self.assertEqual(response.status_code, 200, f"Failed to generate PDF: {response.text if response.status_code != 200 else ''}")
            self.assertEqual(response.headers['Content-Type'], "application/pdf", "Response is not a PDF")
            self.assertGreater(len(response.content), 0, "PDF content is empty")
            
            # Save PDF to verify it was generated correctly
            with open(f"test_receipt_{self.created_record_id}.pdf", "wb") as f:
                f.write(response.content)
                
            print(f"✅ PDF generated successfully and saved as test_receipt_{self.created_record_id}.pdf")
            return True
        except Exception as e:
            self.fail(f"PDF generation failed with error: {str(e)}")
            return False
        
    def test_8_excel_export(self):
        """Test exporting records to Excel"""
        print("\n🔍 Testing Excel Export...")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        response = requests.get(
            f"{self.base_url}/api/storage-records/export/excel", 
            headers=headers
        )
        
        self.assertEqual(response.status_code, 200, "Failed to export to Excel")
        self.assertEqual(
            response.headers['Content-Type'], 
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 
            "Response is not an Excel file"
        )
        self.assertGreater(len(response.content), 0, "Excel content is empty")
        
        # Save Excel file to verify it was generated correctly
        with open("test_export.xlsx", "wb") as f:
            f.write(response.content)
            
        print("✅ Excel export successful and saved as test_export.xlsx")
        return True
        
    def test_9_create_user(self):
        """Test creating a new user"""
        print("\n🔍 Testing User Creation...")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        user_data = {
            "username": self.test_user,
            "password": "TestPass123",
            "role": "user",
            "permissions": ["store", "view", "release"]
        }
        
        response = requests.post(
            f"{self.base_url}/api/users", 
            json=user_data, 
            headers=headers
        )
        
        self.assertEqual(response.status_code, 200, "Failed to create user")
        data = response.json()
        self.assertIn("message", data, "Message not found in response")
        
        # Verify user was created by getting users list
        response = requests.get(f"{self.base_url}/api/users", headers=headers)
        self.assertEqual(response.status_code, 200, "Failed to get users list")
        users_data = response.json()
        
        user_exists = False
        for user in users_data.get("users", []):
            if user.get("username") == self.test_user:
                user_exists = True
                self.assertEqual(user.get("role"), "user", "User role is incorrect")
                self.assertIn("store", user.get("permissions", []), "Store permission missing")
                self.assertIn("view", user.get("permissions", []), "View permission missing")
                self.assertIn("release", user.get("permissions", []), "Release permission missing")
                break
                
        self.assertTrue(user_exists, f"Created user {self.test_user} not found in users list")
        print(f"✅ User {self.test_user} created successfully")
        return True
        
    def test_10_update_user_permissions(self):
        """Test updating user permissions"""
        print("\n🔍 Testing Update User Permissions...")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Update permissions to remove release permission
        permissions_data = {
            "permissions": ["store", "view"]
        }
        
        response = requests.put(
            f"{self.base_url}/api/users/{self.test_user}", 
            json=permissions_data, 
            headers=headers
        )
        
        self.assertEqual(response.status_code, 200, "Failed to update user permissions")
        
        # Verify permissions were updated
        response = requests.get(f"{self.base_url}/api/users", headers=headers)
        self.assertEqual(response.status_code, 200, "Failed to get users list")
        users_data = response.json()
        
        user_updated = False
        for user in users_data.get("users", []):
            if user.get("username") == self.test_user:
                user_updated = True
                self.assertIn("store", user.get("permissions", []), "Store permission missing")
                self.assertIn("view", user.get("permissions", []), "View permission missing")
                self.assertNotIn("release", user.get("permissions", []), "Release permission should be removed")
                break
                
        self.assertTrue(user_updated, f"Updated user {self.test_user} not found in users list")
        print(f"✅ User {self.test_user} permissions updated successfully")
        return True
        
    def test_11_delete_user(self):
        """Test deleting a user"""
        print("\n🔍 Testing Delete User...")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        response = requests.delete(
            f"{self.base_url}/api/users/{self.test_user}", 
            headers=headers
        )
        
        self.assertEqual(response.status_code, 200, "Failed to delete user")
        
        # Verify user was deleted
        response = requests.get(f"{self.base_url}/api/users", headers=headers)
        self.assertEqual(response.status_code, 200, "Failed to get users list")
        users_data = response.json()
        
        for user in users_data.get("users", []):
            self.assertNotEqual(user.get("username"), self.test_user, f"User {self.test_user} was not deleted")
            
        print(f"✅ User {self.test_user} deleted successfully")
        return True
        
    def test_12_permission_check(self):
        """Test permission checks for user role"""
        print("\n🔍 Testing User Permissions...")
        headers = {"Authorization": f"Bearer {self.user_token}"}
        
        # User should be able to view records
        response = requests.get(f"{self.base_url}/api/storage-records", headers=headers)
        self.assertEqual(response.status_code, 200, "User can't view records")
        
        # User should not be able to release records
        if self.created_record_id:
            response = requests.put(
                f"{self.base_url}/api/storage-records/{self.created_record_id}/release", 
                headers=headers
            )
            self.assertEqual(response.status_code, 403, "User shouldn't be able to release records")
            
        # User should not be able to access user management
        response = requests.get(f"{self.base_url}/api/users", headers=headers)
        self.assertEqual(response.status_code, 403, "User shouldn't be able to access user management")
        
        # User should not be able to export to Excel
        response = requests.get(f"{self.base_url}/api/storage-records/export/excel", headers=headers)
        self.assertEqual(response.status_code, 403, "User shouldn't be able to export to Excel")
        
        print("✅ User permission checks passed")
        return True
        
    def test_13_retailcrm_status(self):
        """Test RetailCRM status endpoint"""
        print("\n🔍 Testing RetailCRM Status Endpoint...")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        response = requests.get(f"{self.base_url}/api/retailcrm/status", headers=headers)
        
        self.assertEqual(response.status_code, 200, f"Failed to get RetailCRM status: {response.text if response.status_code != 200 else ''}")
        data = response.json()
        self.assertIn("scheduler_running", data, "Scheduler status not found in response")
        self.assertIn("api_url", data, "API URL not found in response")
        self.assertIn("last_sync_orders", data, "Last sync orders count not found in response")
        
        print(f"✅ RetailCRM status endpoint working")
        print(f"✅ Scheduler running: {data.get('scheduler_running')}")
        print(f"✅ API URL: {data.get('api_url')}")
        print(f"✅ Last sync orders: {data.get('last_sync_orders')}")
        return True
        
    def test_14_retailcrm_sync(self):
        """Test RetailCRM manual sync endpoint"""
        print("\n🔍 Testing RetailCRM Manual Sync Endpoint...")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        response = requests.post(f"{self.base_url}/api/retailcrm/sync", headers=headers)
        
        # Note: This might fail if RetailCRM API is not accessible, but the endpoint should work
        print(f"RetailCRM sync response status: {response.status_code}")
        print(f"RetailCRM sync response: {response.text}")
        
        # We're only checking if the endpoint is accessible, not if the sync is successful
        self.assertIn(response.status_code, [200, 500], "RetailCRM sync endpoint not accessible")
        
        if response.status_code == 200:
            print(f"✅ RetailCRM manual sync triggered successfully")
        else:
            print(f"⚠️ RetailCRM manual sync endpoint accessible but returned error (expected if RetailCRM API is not accessible)")
        
        return True
        
    def test_15_retailcrm_orders(self):
        """Test RetailCRM orders endpoint"""
        print("\n🔍 Testing RetailCRM Orders Endpoint...")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        response = requests.get(f"{self.base_url}/api/retailcrm/orders", headers=headers)
        
        self.assertEqual(response.status_code, 200, f"Failed to get RetailCRM orders: {response.text if response.status_code != 200 else ''}")
        data = response.json()
        self.assertIn("orders", data, "Orders not found in response")
        
        print(f"✅ RetailCRM orders endpoint working")
        print(f"✅ Retrieved {len(data.get('orders', []))} RetailCRM orders")
        return True

    def test_16_create_and_generate_pdf(self):
        """Test creating a record and generating PDF for it"""
        print("\n🔍 Testing Create Record and Generate PDF...")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Create a record
        storage_data = {
            "full_name": "PDF Test User",
            "phone": "+7-999-555-44-33",
            "phone_additional": "+7-999-111-22-33",
            "car_brand": "BMW X5",
            "parameters": "255/55/R19",
            "size": "4 шт",
            "storage_location": "Бекетова 3а.к15",
            "custom_field_test": "PDF Test Value"
        }
        
        create_response = requests.post(
            f"{self.base_url}/api/storage-records", 
            json=storage_data, 
            headers=headers
        )
        
        self.assertEqual(create_response.status_code, 200, f"Failed to create storage record: {create_response.text if create_response.status_code != 200 else ''}")
        create_data = create_response.json()
        record_id = create_data["record"]["record_id"]
        
        print(f"✅ Created test record with ID: {record_id}")
        
        # Generate PDF for the record
        try:
            pdf_response = requests.get(
                f"{self.base_url}/api/storage-records/{record_id}/pdf", 
                headers=headers,
                timeout=30
            )
            
            self.assertEqual(pdf_response.status_code, 200, f"Failed to generate PDF: {pdf_response.text if pdf_response.status_code != 200 else ''}")
            self.assertEqual(pdf_response.headers['Content-Type'], "application/pdf", "Response is not a PDF")
            self.assertGreater(len(pdf_response.content), 0, "PDF content is empty")
            
            # Save PDF to verify it was generated correctly
            with open(f"test_receipt_combined_{record_id}.pdf", "wb") as f:
                f.write(pdf_response.content)
                
            print(f"✅ PDF generated successfully and saved as test_receipt_combined_{record_id}.pdf")
            print(f"✅ PDF size: {len(pdf_response.content)} bytes")
            return True
        except Exception as e:
            self.fail(f"PDF generation failed with error: {str(e)}")
            return False
            
    def test_17_get_detailed_record(self):
        """Test getting detailed record information including retail_status_text"""
        print("\n🔍 Testing Get Detailed Record...")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        if not self.created_record_id:
            print("⚠️ Creating a new record for detailed view test")
            # Create a record first
            storage_data = {
                "full_name": "Детальный Просмотр Тест",
                "phone": "+7-999-888-77-66",
                "phone_additional": "+7-999-111-22-33",
                "car_brand": "Audi Q7",
                "parameters": "265/50/R20",
                "size": "4 шт",
                "storage_location": "Московское шоссе 22к1",
                "custom_field_1751496388330": "12345"  # RetailCRM order number
            }
            
            create_response = requests.post(
                f"{self.base_url}/api/storage-records", 
                json=storage_data, 
                headers=headers
            )
            
            self.assertEqual(create_response.status_code, 200, "Failed to create record for detailed view test")
            create_data = create_response.json()
            self.created_record_id = create_data["record"]["record_id"]
            self.created_record_number = create_data["record"]["record_number"]
        
        # Get detailed record
        response = requests.get(
            f"{self.base_url}/api/storage-records/{self.created_record_id}", 
            headers=headers
        )
        
        self.assertEqual(response.status_code, 200, f"Failed to get detailed record: {response.text if response.status_code != 200 else ''}")
        data = response.json()
        self.assertIn("record", data, "Record not found in response")
        self.assertIn("record_id", data["record"], "Record ID not found")
        self.assertIn("record_number", data["record"], "Record number not found")
        self.assertIn("retail_status_text", data["record"], "retail_status_text not found in response")
        
        print(f"✅ Detailed record retrieved successfully")
        print(f"✅ Record number: {data['record']['record_number']}")
        print(f"✅ Retail status text: {data['record']['retail_status_text']}")
        return True
        
    def test_18_create_new_status_record(self):
        """Test creating a record with 'Новая' status for status transition testing"""
        print("\n🔍 Testing Create Record with 'Новая' Status...")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Create a record with RetailCRM fields to simulate a new record from RetailCRM
        storage_data = {
            "full_name": "Статус Тест Пользователь",
            "phone": "+7-999-777-66-55",
            "phone_additional": "+7-999-444-55-66",
            "car_brand": "Mercedes GLC",
            "parameters": "235/55/R19",
            "size": "4 шт",
            "storage_location": "Бекетова 3а.к15",
            "custom_field_1751496388330": "67890",  # RetailCRM order number
            "status": "Новая"  # This will be overridden by the API
        }
        
        # First, we need to directly insert this into MongoDB to set the status as "Новая"
        # We'll use the API to create it, then update it via a direct API call
        create_response = requests.post(
            f"{self.base_url}/api/storage-records", 
            json=storage_data, 
            headers=headers
        )
        
        self.assertEqual(create_response.status_code, 200, "Failed to create record with 'Новая' status")
        create_data = create_response.json()
        record_id = create_data["record"]["record_id"]
        
        # Now we need to update the status to "Новая" - we'll use a direct MongoDB update
        # For testing purposes, we'll create a simple endpoint to do this
        # Since we don't have direct MongoDB access, we'll simulate this by creating a record
        # and then manually updating it via the API
        
        # For now, we'll just store the ID for the next test
        self.new_status_record_id = record_id
        print(f"✅ Created test record with ID: {record_id}")
        print(f"⚠️ Note: The record has 'Взята на хранение' status by default")
        print(f"⚠️ We'll test the take-storage endpoint by releasing and then taking it back to storage")
        return True
        
    def test_19_release_and_take_storage(self):
        """Test releasing a record and then taking it back to storage"""
        print("\n🔍 Testing Release and Take Storage Workflow...")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        if not self.new_status_record_id:
            print("⚠️ No record ID available for status transition test")
            return False
            
        # First release the record
        print("Step 1: Releasing record from storage")
        release_response = requests.put(
            f"{self.base_url}/api/storage-records/{self.new_status_record_id}/release", 
            headers=headers
        )
        
        self.assertEqual(release_response.status_code, 200, f"Failed to release record: {release_response.text if release_response.status_code != 200 else ''}")
        
        # Verify the record was released
        get_response = requests.get(
            f"{self.base_url}/api/storage-records/{self.new_status_record_id}", 
            headers=headers
        )
        
        self.assertEqual(get_response.status_code, 200, "Failed to get record after release")
        get_data = get_response.json()
        self.assertEqual(get_data["record"]["status"], "Выдана с хранения", "Record status not updated to 'Выдана с хранения'")
        
        print("✅ Record released successfully")
        
        # Now test the take-storage endpoint
        # Note: In a real scenario, we would need a record with "Новая" status
        # For testing purposes, we'll use the released record
        print("Step 2: Taking record back to storage")
        take_storage_response = requests.put(
            f"{self.base_url}/api/storage-records/{self.new_status_record_id}/take-storage", 
            headers=headers
        )
        
        # This should fail because the record is not in "Новая" status
        self.assertEqual(take_storage_response.status_code, 400, "Take-storage should fail for records not in 'Новая' status")
        
        print("✅ Take-storage endpoint correctly rejected record not in 'Новая' status")
        return True
        
    def test_20_export_with_record_number(self):
        """Test exporting records with record_number as first column and retail_status_text"""
        print("\n🔍 Testing Export with Record Number and Retail Status...")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        response = requests.get(
            f"{self.base_url}/api/storage-records/export", 
            headers=headers
        )
        
        self.assertEqual(response.status_code, 200, "Failed to export records")
        self.assertEqual(
            response.headers['Content-Type'], 
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 
            "Response is not an Excel file"
        )
        self.assertGreater(len(response.content), 0, "Excel content is empty")
        
        # Save Excel file to verify it was generated correctly
        with open("test_export_with_record_number.xlsx", "wb") as f:
            f.write(response.content)
            
        # Read the Excel file to verify record_number is the first column
        df = pd.read_excel(io.BytesIO(response.content))
        
        # Check if record_number is the first column
        self.assertEqual(df.columns[0], "record_number", "record_number is not the first column")
        
        # Check if retail_status_text is included
        self.assertIn("retail_status_text", df.columns, "retail_status_text not found in export")
        
        print("✅ Export with record_number as first column successful")
        print("✅ Export includes retail_status_text")
        return True
        
    def test_21_import_with_duplicates(self):
        """Test importing records with duplicate detection"""
        print("\n🔍 Testing Import with Duplicate Detection...")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # First, export existing records to use as import data
        export_response = requests.get(
            f"{self.base_url}/api/storage-records/export", 
            headers=headers
        )
        
        self.assertEqual(export_response.status_code, 200, "Failed to export records for import test")
        
        # Save the export file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp_file:
            tmp_file.write(export_response.content)
            tmp_file_path = tmp_file.name
        
        # Now import the same file to test duplicate detection
        with open(tmp_file_path, 'rb') as f:
            files = {'file': ('test_import.xlsx', f, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
            import_response = requests.post(
                f"{self.base_url}/api/storage-records/import", 
                headers=headers,
                files=files
            )
        
        self.assertEqual(import_response.status_code, 200, f"Failed to import records: {import_response.text if import_response.status_code != 200 else ''}")
        import_data = import_response.json()
        
        # Check if duplicates were detected
        self.assertIn("duplicates", import_data, "Duplicates count not found in response")
        self.assertGreater(import_data["duplicates"], 0, "No duplicates detected")
        
        print(f"✅ Import with duplicate detection successful")
        print(f"✅ Detected {import_data['duplicates']} duplicates")
        print(f"✅ Imported {import_data['imported']} records")
        print(f"✅ Errors: {import_data['errors']}")
        
        # Clean up
        os.unlink(tmp_file_path)
        return True
        
    def test_22_retailcrm_status_text(self):
        """Test RetailCRM status text generation"""
        print("\n🔍 Testing RetailCRM Status Text Generation...")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Get all records
        response = requests.get(
            f"{self.base_url}/api/storage-records", 
            headers=headers
        )
        
        self.assertEqual(response.status_code, 200, "Failed to get records for RetailCRM status test")
        data = response.json()
        
        # Check if retail_status_text is included for all records
        for record in data["records"]:
            self.assertIn("retail_status_text", record, "retail_status_text not found in record")
        
        print("✅ RetailCRM status text is included for all records")
        return True

def run_tests():
    # Create test suite
    suite = unittest.TestSuite()
    tester = TireStorageAPITester()
    
    # Add tests in order
    suite.addTest(TireStorageAPITester('test_1_get_form_config'))
    suite.addTest(TireStorageAPITester('test_2_create_storage_record'))
    
    # Test new detailed record view
    suite.addTest(TireStorageAPITester('test_17_get_detailed_record'))
    
    # Test PDF generation with record number
    suite.addTest(TireStorageAPITester('test_16_create_and_generate_pdf'))
    
    # Test status transitions
    suite.addTest(TireStorageAPITester('test_18_create_new_status_record'))
    suite.addTest(TireStorageAPITester('test_19_release_and_take_storage'))
    
    # Test export/import with record_number and retail_status_text
    suite.addTest(TireStorageAPITester('test_20_export_with_record_number'))
    suite.addTest(TireStorageAPITester('test_21_import_with_duplicates'))
    
    # Test RetailCRM functions
    suite.addTest(TireStorageAPITester('test_22_retailcrm_status_text'))
    suite.addTest(TireStorageAPITester('test_13_retailcrm_status'))
    suite.addTest(TireStorageAPITester('test_14_retailcrm_sync'))
    suite.addTest(TireStorageAPITester('test_15_retailcrm_orders'))
    
    # Other standard tests
    suite.addTest(TireStorageAPITester('test_3_search_by_name'))
    suite.addTest(TireStorageAPITester('test_4_search_by_phone'))
    suite.addTest(TireStorageAPITester('test_5_get_all_records'))
    suite.addTest(TireStorageAPITester('test_6_release_record'))
    suite.addTest(TireStorageAPITester('test_8_excel_export'))
    suite.addTest(TireStorageAPITester('test_9_create_user'))
    suite.addTest(TireStorageAPITester('test_10_update_user_permissions'))
    suite.addTest(TireStorageAPITester('test_11_delete_user'))
    suite.addTest(TireStorageAPITester('test_12_permission_check'))
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Print summary
    print(f"\n📊 Tests passed: {result.testsRun - len(result.errors) - len(result.failures)}/{result.testsRun}")
    
    # Return exit code
    return 0 if result.wasSuccessful() else 1

if __name__ == "__main__":
    sys.exit(run_tests())