import requests
import unittest
import sys
import io
import os
import json
import tempfile
import pandas as pd
from datetime import datetime
import re

class BulkDeleteAndPDFTester(unittest.TestCase):
    def __init__(self, *args, **kwargs):
        super(BulkDeleteAndPDFTester, self).__init__(*args, **kwargs)
        # Get the backend URL from frontend/.env
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    self.base_url = line.strip().split('=')[1].strip('"\'')
                    break
        print(f"Using backend URL: {self.base_url}")
        self.admin_token = None
        self.created_record_ids = []
        self.test_template = "ТЕСТ: Акт №{record_number} для {full_name}, телефон {phone}"

    def setUp(self):
        # Login as admin to get token
        self.admin_login()

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

    def test_1_count_records(self):
        """Test counting records to verify database cleanup"""
        print("\n🔍 Counting records in database...")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        response = requests.get(f"{self.base_url}/api/storage-records", headers=headers)
        
        self.assertEqual(response.status_code, 200, "Failed to get records")
        data = response.json()
        records = data.get("records", [])
        
        print(f"✅ Found {len(records)} records in database")
        
        # Print record details
        for record in records:
            print(f"  - Record #{record.get('record_number')}: {record.get('full_name')}, ID: {record.get('record_id')}")
        
        return len(records)

    def test_2_save_pdf_template(self):
        """Test saving a custom PDF template"""
        print("\n🔍 Testing Save PDF Template...")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        template_data = {
            "template": self.test_template
        }
        
        response = requests.put(
            f"{self.base_url}/api/pdf-template", 
            json=template_data, 
            headers=headers
        )
        
        self.assertEqual(response.status_code, 200, f"Failed to save PDF template: {response.text if response.status_code != 200 else ''}")
        data = response.json()
        self.assertIn("message", data, "Message not found in response")
        
        print(f"✅ PDF template saved successfully: {self.test_template}")
        return True

    def test_3_load_pdf_template(self):
        """Test loading the PDF template"""
        print("\n🔍 Testing Load PDF Template...")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        response = requests.get(f"{self.base_url}/api/pdf-template", headers=headers)
        
        self.assertEqual(response.status_code, 200, f"Failed to load PDF template: {response.text if response.status_code != 200 else ''}")
        data = response.json()
        self.assertIn("template", data, "Template not found in response")
        
        # Verify the template matches what we saved
        self.assertEqual(data["template"], self.test_template, "Template does not match what was saved")
        
        print(f"✅ PDF template loaded successfully: {data['template']}")
        return True

    def test_4_create_record(self):
        """Test creating a record for PDF generation"""
        print("\n🔍 Testing Create Record for PDF Generation...")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        storage_data = {
            "full_name": "Тестов Тест Тестович",
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
        
        self.assertEqual(response.status_code, 200, f"Failed to create storage record: {response.text if response.status_code != 200 else ''}")
        data = response.json()
        self.assertIn("record", data, "Record not found in response")
        self.assertIn("record_id", data["record"], "Record ID not found")
        
        record_id = data["record"]["record_id"]
        record_number = data["record"]["record_number"]
        
        # Save record ID for later tests
        self.created_record_ids.append(record_id)
        
        print(f"✅ Storage record created successfully with ID: {record_id}")
        print(f"✅ Record number: {record_number}")
        
        return record_id

    def test_5_generate_pdf(self, record_id):
        """Test generating PDF with custom template"""
        print("\n🔍 Testing PDF Generation with Custom Template...")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        try:
            response = requests.get(
                f"{self.base_url}/api/storage-records/{record_id}/pdf", 
                headers=headers,
                timeout=30
            )
            
            self.assertEqual(response.status_code, 200, f"Failed to generate PDF: {response.text if response.status_code != 200 else ''}")
            self.assertEqual(response.headers['Content-Type'], "application/pdf", "Response is not a PDF")
            self.assertGreater(len(response.content), 0, "PDF content is empty")
            
            # Save PDF to verify it was generated correctly
            pdf_filename = f"test_custom_template_{record_id}.pdf"
            with open(pdf_filename, "wb") as f:
                f.write(response.content)
                
            print(f"✅ PDF generated successfully and saved as {pdf_filename}")
            print(f"✅ PDF size: {len(response.content)} bytes")
            
            # We can't easily check the PDF content programmatically,
            # but we've saved it for manual inspection
            print("✅ PDF should contain the custom template text (manual verification required)")
            
            return True
        except Exception as e:
            self.fail(f"PDF generation failed with error: {str(e)}")
            return False

    def test_6_bulk_delete(self):
        """Test bulk delete endpoint"""
        print("\n🔍 Testing Bulk Delete Endpoint...")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Get all records
        response = requests.get(f"{self.base_url}/api/storage-records", headers=headers)
        self.assertEqual(response.status_code, 200, "Failed to get records")
        data = response.json()
        records = data.get("records", [])
        
        # Keep only 3 records, delete the rest
        records_to_keep = 3
        records_to_delete = []
        
        if len(records) <= records_to_keep:
            print(f"⚠️ Only {len(records)} records found, need at least {records_to_keep+1} to test bulk delete")
            return True
        
        # Get record IDs to delete (all except the first 3)
        for record in records[records_to_keep:]:
            records_to_delete.append(record.get("record_id"))
        
        print(f"✅ Found {len(records)} records, keeping {records_to_keep}, deleting {len(records_to_delete)}")
        
        # Delete records in bulk
        response = requests.delete(
            f"{self.base_url}/api/storage-records/bulk", 
            json=records_to_delete,
            headers=headers
        )
        
        self.assertEqual(response.status_code, 200, f"Failed to delete records in bulk: {response.text if response.status_code != 200 else ''}")
        data = response.json()
        
        # Verify the correct number of records were deleted
        self.assertEqual(data.get("deleted_count"), len(records_to_delete), f"Expected to delete {len(records_to_delete)} records, but deleted {data.get('deleted_count')}")
        
        print(f"✅ Successfully deleted {data.get('deleted_count')} records in bulk")
        
        # Verify only 3 records remain
        response = requests.get(f"{self.base_url}/api/storage-records", headers=headers)
        self.assertEqual(response.status_code, 200, "Failed to get records after bulk delete")
        data = response.json()
        records_after = data.get("records", [])
        
        self.assertEqual(len(records_after), records_to_keep, f"Expected {records_to_keep} records after bulk delete, but found {len(records_after)}")
        
        print(f"✅ Verified {len(records_after)} records remain after bulk delete")
        
        # Print remaining records
        for record in records_after:
            print(f"  - Record #{record.get('record_number')}: {record.get('full_name')}, ID: {record.get('record_id')}")
        
        return True

def run_tests():
    # Create test suite
    suite = unittest.TestSuite()
    tester = BulkDeleteAndPDFTester()
    
    # Count records before tests
    initial_count = tester.test_1_count_records()
    
    # Save and load PDF template
    tester.test_2_save_pdf_template()
    tester.test_3_load_pdf_template()
    
    # Create record and generate PDF
    record_id = tester.test_4_create_record()
    tester.test_5_generate_pdf(record_id)
    
    # Bulk delete to clean up database
    tester.test_6_bulk_delete()
    
    # Count records after tests
    final_count = tester.test_1_count_records()
    
    # Print summary
    print(f"\n📊 Initial record count: {initial_count}")
    print(f"📊 Final record count: {final_count}")
    print(f"📊 Records deleted: {initial_count - final_count}")
    
    return 0

if __name__ == "__main__":
    sys.exit(run_tests())