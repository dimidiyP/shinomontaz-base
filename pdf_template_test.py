import requests
import unittest
import sys
import io
import os
import json
import tempfile
from datetime import datetime

class PDFTemplateAPITester(unittest.TestCase):
    def __init__(self, *args, **kwargs):
        super(PDFTemplateAPITester, self).__init__(*args, **kwargs)
        # Get the backend URL from frontend/.env
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    self.base_url = line.strip().split('=')[1].strip('"\'')
                    break
        print(f"Using backend URL: {self.base_url}")
        self.admin_token = None
        self.test_record_id = None
        self.test_record_number = None

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

    def test_1_get_pdf_template(self):
        """Test getting PDF template"""
        print("\n🔍 Testing Get PDF Template...")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        response = requests.get(f"{self.base_url}/api/pdf-template", headers=headers)
        
        self.assertEqual(response.status_code, 200, "Failed to get PDF template")
        data = response.json()
        self.assertIn("template", data, "Template not found in response")
        print(f"✅ PDF template retrieved successfully: {data['template']}")
        return True

    def test_2_update_pdf_template(self):
        """Test updating PDF template"""
        print("\n🔍 Testing Update PDF Template...")
        headers = {
            "Authorization": f"Bearer {self.admin_token}",
            "Content-Type": "application/json"
        }
        
        # Custom template with Russian text
        custom_template = "Акт хранения №{record_number}. Клиент: {full_name}, тел: {phone}. Товар: {parameters}, количество: {size}. Дата: {created_at}"
        
        response = requests.put(
            f"{self.base_url}/api/pdf-template", 
            headers=headers,
            json={"template": custom_template}
        )
        
        self.assertEqual(response.status_code, 200, f"Failed to update PDF template: {response.text if response.status_code != 200 else ''}")
        data = response.json()
        self.assertIn("message", data, "Message not found in response")
        print(f"✅ PDF template updated successfully: {data['message']}")
        
        # Verify the template was updated
        get_response = requests.get(f"{self.base_url}/api/pdf-template", headers=headers)
        self.assertEqual(get_response.status_code, 200, "Failed to get updated PDF template")
        get_data = get_response.json()
        self.assertEqual(get_data["template"], custom_template, "Template was not updated correctly")
        print("✅ Template update verified")
        return True

    def test_3_create_record_with_russian_data(self):
        """Test creating a record with Russian data"""
        print("\n🔍 Testing Create Record with Russian Data...")
        headers = {
            "Authorization": f"Bearer {self.admin_token}",
            "Content-Type": "application/json"
        }
        
        # Create a record with Russian data
        storage_data = {
            "full_name": "Петров Петр Петрович",
            "phone": "9991234567",
            "phone_additional": "",
            "car_brand": "Лада Веста",
            "parameters": "Летние шины R18",
            "size": "4 штуки",
            "storage_location": "Бекетова 3а.к15"
        }
        
        response = requests.post(
            f"{self.base_url}/api/storage-records", 
            headers=headers,
            json=storage_data
        )
        
        self.assertEqual(response.status_code, 200, f"Failed to create record: {response.text if response.status_code != 200 else ''}")
        data = response.json()
        self.assertIn("record", data, "Record not found in response")
        self.assertIn("record_id", data["record"], "Record ID not found")
        self.assertIn("record_number", data["record"], "Record number not found")
        
        # Save record ID for PDF generation test
        self.test_record_id = data["record"]["record_id"]
        self.test_record_number = data["record"]["record_number"]
        
        print(f"✅ Record created successfully with ID: {self.test_record_id}")
        print(f"✅ Record number: {self.test_record_number}")
        return self.test_record_id

    def test_4_generate_pdf_with_custom_template(self):
        """Test generating PDF with custom template"""
        print("\n🔍 Testing Generate PDF with Custom Template...")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        if not self.test_record_id:
            self.fail("No record ID available for PDF generation test")
        
        try:
            response = requests.get(
                f"{self.base_url}/api/storage-records/{self.test_record_id}/pdf", 
                headers=headers,
                timeout=30
            )
            
            self.assertEqual(response.status_code, 200, f"Failed to generate PDF: {response.text if response.status_code != 200 else ''}")
            self.assertEqual(response.headers['Content-Type'], "application/pdf", "Response is not a PDF")
            self.assertGreater(len(response.content), 0, "PDF content is empty")
            
            # Save PDF to verify it was generated correctly
            with open(f"test_custom_template_{self.test_record_id}.pdf", "wb") as f:
                f.write(response.content)
                
            print(f"✅ PDF generated successfully and saved as test_custom_template_{self.test_record_id}.pdf")
            print(f"✅ PDF size: {len(response.content)} bytes")
            return True
        except Exception as e:
            self.fail(f"PDF generation failed with error: {str(e)}")
            return False

    def test_5_restore_default_template(self):
        """Test restoring default PDF template"""
        print("\n🔍 Testing Restore Default PDF Template...")
        headers = {
            "Authorization": f"Bearer {self.admin_token}",
            "Content-Type": "application/json"
        }
        
        # Default template
        default_template = "Я {full_name}, {phone}, оставил на хранение {parameters}, {size}, в Шинном Бюро по адресу {storage_location}, номер акта {record_number} {created_at}. Подпись: _________________"
        
        response = requests.put(
            f"{self.base_url}/api/pdf-template", 
            headers=headers,
            json={"template": default_template}
        )
        
        self.assertEqual(response.status_code, 200, f"Failed to restore default template: {response.text if response.status_code != 200 else ''}")
        data = response.json()
        self.assertIn("message", data, "Message not found in response")
        print(f"✅ Default PDF template restored successfully: {data['message']}")
        
        # Verify the template was updated
        get_response = requests.get(f"{self.base_url}/api/pdf-template", headers=headers)
        self.assertEqual(get_response.status_code, 200, "Failed to get restored PDF template")
        get_data = get_response.json()
        self.assertEqual(get_data["template"], default_template, "Template was not restored correctly")
        print("✅ Template restoration verified")
        return True

def run_tests():
    # Create test suite
    suite = unittest.TestSuite()
    tester = PDFTemplateAPITester()
    
    # Add tests in order
    suite.addTest(PDFTemplateAPITester('test_1_get_pdf_template'))
    suite.addTest(PDFTemplateAPITester('test_2_update_pdf_template'))
    
    # Run test_3 first and get the record ID
    test3 = PDFTemplateAPITester('test_3_create_record_with_russian_data')
    result3 = unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite([test3]))
    if result3.wasSuccessful():
        # Now run test_4 with the record ID
        suite.addTest(PDFTemplateAPITester('test_4_generate_pdf_with_custom_template'))
    
    suite.addTest(PDFTemplateAPITester('test_5_restore_default_template'))
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Print summary
    print(f"\n📊 Tests passed: {result.testsRun - len(result.errors) - len(result.failures)}/{result.testsRun}")
    
    # Return exit code
    return 0 if result.wasSuccessful() and result3.wasSuccessful() else 1

if __name__ == "__main__":
    sys.exit(run_tests())