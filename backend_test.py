import requests
import unittest
import sys
import io
import os
from datetime import datetime

class TireStorageAPITester(unittest.TestCase):
    def __init__(self, *args, **kwargs):
        super(TireStorageAPITester, self).__init__(*args, **kwargs)
        self.base_url = "https://e08027cd-4173-4964-84cf-47b25afe27fc.preview.emergentagent.com"
        self.admin_token = None
        self.user_token = None
        self.created_record_id = None
        self.created_record_number = None
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
        
        storage_data = {
            "full_name": "Иванов Иван Иванович",
            "phone": "+7-999-123-45-67",
            "phone_additional": "+7-999-987-65-43",
            "car_brand": "Toyota Camry",
            "parameters": "215/60/R16",
            "size": "4 шт",
            "storage_location": "Бекетова 3а.к15"
        }
        
        response = requests.post(
            f"{self.base_url}/api/storage-records", 
            json=storage_data, 
            headers=headers
        )
        
        self.assertEqual(response.status_code, 200, "Failed to create storage record")
        data = response.json()
        self.assertIn("record", data, "Record not found in response")
        self.assertIn("record_id", data["record"], "Record ID not found")
        self.assertIn("record_number", data["record"], "Record number not found")
        self.assertEqual(data["record"]["status"], "Взята на хранение", "Status is not correct")
        self.assertIn("created_at", data["record"], "Created at timestamp not found")
        self.assertIn("created_by", data["record"], "Creator username not found")
        
        # Save record ID for later tests
        self.created_record_id = data["record"]["record_id"]
        self.created_record_number = data["record"]["record_number"]
        
        print(f"✅ Storage record created successfully with ID: {self.created_record_id}")
        print(f"✅ Record number: {self.created_record_number}")
        return True

    def test_3_search_by_name(self):
        """Test searching for a record by name"""
        print("\n🔍 Testing Search by Name...")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        response = requests.get(
            f"{self.base_url}/api/storage-records/search?query=Иванов&search_type=full_name", 
            headers=headers
        )
        
        self.assertEqual(response.status_code, 200, "Failed to search by name")
        data = response.json()
        self.assertIn("records", data, "Records not found in response")
        self.assertGreater(len(data["records"]), 0, "No records found")
        print(f"✅ Found {len(data['records'])} records by name")
        return True

    def test_4_search_by_phone(self):
        """Test searching for a record by phone"""
        print("\n🔍 Testing Search by Phone...")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        response = requests.get(
            f"{self.base_url}/api/storage-records/search?query=999-123&search_type=phone", 
            headers=headers
        )
        
        self.assertEqual(response.status_code, 200, "Failed to search by phone")
        data = response.json()
        self.assertIn("records", data, "Records not found in response")
        self.assertGreater(len(data["records"]), 0, "No records found")
        print(f"✅ Found {len(data['records'])} records by phone")
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

    def test_7_permission_check(self):
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
        
        print("✅ User permission checks passed")
        return True

def run_tests():
    # Create test suite
    suite = unittest.TestSuite()
    tester = TireStorageAPITester()
    
    # Add tests in order
    suite.addTest(TireStorageAPITester('test_1_get_form_config'))
    suite.addTest(TireStorageAPITester('test_2_create_storage_record'))
    suite.addTest(TireStorageAPITester('test_3_search_by_name'))
    suite.addTest(TireStorageAPITester('test_4_search_by_phone'))
    suite.addTest(TireStorageAPITester('test_5_get_all_records'))
    suite.addTest(TireStorageAPITester('test_6_release_record'))
    suite.addTest(TireStorageAPITester('test_7_permission_check'))
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Print summary
    print(f"\n📊 Tests passed: {result.testsRun - len(result.errors) - len(result.failures)}/{result.testsRun}")
    
    # Return exit code
    return 0 if result.wasSuccessful() else 1

if __name__ == "__main__":
    sys.exit(run_tests())