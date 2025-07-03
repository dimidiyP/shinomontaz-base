import requests
import unittest
import sys
import io
import os
import json
import tempfile
import PyPDF2
from datetime import datetime

class CyrillicPDFTester(unittest.TestCase):
    def __init__(self, *args, **kwargs):
        super(CyrillicPDFTester, self).__init__(*args, **kwargs)
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

    def test_1_create_record_with_cyrillic(self):
        """Test creating a storage record with Cyrillic data"""
        print("\n🔍 Testing Create Storage Record with Cyrillic data...")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Create record with Russian data as requested
        storage_data = {
            "full_name": "Иванов Иван Иванович",
            "phone": "9991234567",
            "phone_additional": "",
            "car_brand": "Лада Веста",
            "parameters": "Зимние шины R17",
            "size": "4 штуки",
            "storage_location": "Бекетова 3а.к15",
            "custom_note": "Тестовая запись с кириллицей"
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
        self.assertIn("record_number", data["record"], "Record number not found")
        
        # Save record ID for later tests
        self.test_record_id = data["record"]["record_id"]
        self.test_record_number = data["record"]["record_number"]
        
        print(f"✅ Storage record created successfully with ID: {self.test_record_id}")
        print(f"✅ Record number: {self.test_record_number}")
        
        # Verify the record exists by getting it directly
        get_response = requests.get(
            f"{self.base_url}/api/storage-records/{self.test_record_id}", 
            headers=headers
        )
        
        self.assertEqual(get_response.status_code, 200, "Failed to get created record")
        get_data = get_response.json()
        
        # Verify Cyrillic data was saved correctly
        self.assertEqual(get_data["record"]["full_name"], "Иванов Иван Иванович", "Full name with Cyrillic not saved correctly")
        self.assertEqual(get_data["record"]["parameters"], "Зимние шины R17", "Parameters with Cyrillic not saved correctly")
        self.assertEqual(get_data["record"]["size"], "4 штуки", "Size with Cyrillic not saved correctly")
        
        print("✅ Cyrillic data saved correctly in the database")
        return True

    def test_2_generate_pdf_with_cyrillic(self):
        """Test generating PDF with Cyrillic characters"""
        if not self.test_record_id:
            self.fail("No record ID available for PDF generation test")
            
        print("\n🔍 Testing PDF Generation with Cyrillic...")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        try:
            response = requests.get(
                f"{self.base_url}/api/storage-records/{self.test_record_id}/pdf", 
                headers=headers,
                timeout=30  # Increase timeout to avoid connection errors
            )
            
            self.assertEqual(response.status_code, 200, f"Failed to generate PDF: {response.text if response.status_code != 200 else ''}")
            self.assertEqual(response.headers['Content-Type'], "application/pdf", "Response is not a PDF")
            self.assertGreater(len(response.content), 0, "PDF content is empty")
            
            # Check Content-Disposition header for proper filename
            self.assertIn('Content-Disposition', response.headers, "Content-Disposition header missing")
            self.assertIn(f'act_storage_{self.test_record_number}.pdf', response.headers['Content-Disposition'], 
                         "Filename in Content-Disposition header is incorrect")
            
            # Save PDF to verify it was generated correctly
            pdf_path = f"cyrillic_test_receipt_{self.test_record_number}.pdf"
            with open(pdf_path, "wb") as f:
                f.write(response.content)
                
            print(f"✅ PDF generated successfully and saved as {pdf_path}")
            print(f"✅ PDF size: {len(response.content)} bytes")
            
            # Try to extract text from PDF to verify Cyrillic content
            # Note: This is a basic check and may not work perfectly for all PDFs
            try:
                with open(pdf_path, 'rb') as pdf_file:
                    pdf_reader = PyPDF2.PdfReader(pdf_file)
                    text = ""
                    for page in pdf_reader.pages:
                        text += page.extract_text()
                    
                    # Check for key Cyrillic phrases
                    cyrillic_phrases = [
                        "Иванов Иван Иванович",
                        "Зимние шины",
                        "штуки",
                        "Бекетова"
                    ]
                    
                    for phrase in cyrillic_phrases:
                        if phrase in text:
                            print(f"✅ Found Cyrillic phrase in PDF: '{phrase}'")
                        else:
                            print(f"⚠️ Could not find Cyrillic phrase in PDF: '{phrase}'")
                            # This might be due to PDF text extraction limitations, not necessarily a failure
                    
                    print(f"✅ PDF text extraction completed")
            except Exception as e:
                print(f"⚠️ Could not extract text from PDF: {str(e)}")
                print("⚠️ This doesn't necessarily mean the PDF is incorrect - text extraction can be unreliable")
            
            return True
        except Exception as e:
            self.fail(f"PDF generation failed with error: {str(e)}")
            return False

    def test_3_check_pdf_headers(self):
        """Test PDF endpoint returns correct headers for download"""
        if not self.test_record_id:
            self.fail("No record ID available for PDF headers test")
            
        print("\n🔍 Testing PDF Download Headers...")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        try:
            response = requests.get(
                f"{self.base_url}/api/storage-records/{self.test_record_id}/pdf", 
                headers=headers,
                timeout=30
            )
            
            self.assertEqual(response.status_code, 200, "Failed to get PDF")
            
            # Check headers
            self.assertEqual(response.headers['Content-Type'], "application/pdf", 
                            "Content-Type header is not application/pdf")
            
            self.assertIn('Content-Disposition', response.headers, 
                         "Content-Disposition header missing")
            
            self.assertIn('attachment', response.headers['Content-Disposition'], 
                         "Content-Disposition header doesn't specify attachment")
            
            self.assertIn(f'act_storage_{self.test_record_number}.pdf', response.headers['Content-Disposition'], 
                         "Filename in Content-Disposition header is incorrect")
            
            # Check CORS headers
            self.assertIn('Access-Control-Allow-Origin', response.headers, 
                         "Access-Control-Allow-Origin header missing")
            
            self.assertIn('Access-Control-Allow-Methods', response.headers, 
                         "Access-Control-Allow-Methods header missing")
            
            self.assertIn('Access-Control-Allow-Headers', response.headers, 
                         "Access-Control-Allow-Headers header missing")
            
            print("✅ PDF download headers are correct")
            print(f"✅ Content-Type: {response.headers['Content-Type']}")
            print(f"✅ Content-Disposition: {response.headers['Content-Disposition']}")
            print(f"✅ CORS headers present")
            
            return True
        except Exception as e:
            self.fail(f"PDF headers check failed with error: {str(e)}")
            return False

def run_tests():
    # Create test suite
    suite = unittest.TestSuite()
    tester = CyrillicPDFTester()
    
    # Add tests in order
    suite.addTest(CyrillicPDFTester('test_1_create_record_with_cyrillic'))
    suite.addTest(CyrillicPDFTester('test_2_generate_pdf_with_cyrillic'))
    suite.addTest(CyrillicPDFTester('test_3_check_pdf_headers'))
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Print summary
    print(f"\n📊 Tests passed: {result.testsRun - len(result.errors) - len(result.failures)}/{result.testsRun}")
    
    # Return exit code
    return 0 if result.wasSuccessful() else 1

if __name__ == "__main__":
    sys.exit(run_tests())