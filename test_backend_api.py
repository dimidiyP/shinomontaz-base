import requests
import json
import time
import os

# Backend URL from the request
BASE_URL = "https://baseshinomontaz.ru/api"

# Test credentials
USERNAME = "admin"
PASSWORD = "K2enlzuzz2"

# Store the authentication token
token = None

def login():
    """Authenticate and get token"""
    global token
    
    print("\n=== Testing Authentication ===")
    
    login_data = {
        "username": USERNAME,
        "password": PASSWORD
    }
    
    try:
        response = requests.post(f"{BASE_URL}/login", json=login_data)
        response.raise_for_status()
        
        data = response.json()
        token = data.get("access_token")
        
        if token:
            print(f"✅ Authentication successful. User: {data['user']['username']}, Role: {data['user']['role']}")
            return True
        else:
            print("❌ Authentication failed: No token received")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Authentication failed: {str(e)}")
        return False

def check_health():
    """Check if the API is healthy"""
    print("\n=== Testing Health Endpoint ===")
    
    try:
        response = requests.get(f"{BASE_URL}/health")
        response.raise_for_status()
        
        data = response.json()
        if data.get("status") == "healthy":
            print("✅ Health check passed")
            return True
        else:
            print(f"❌ Health check failed: {data}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Health check failed: {str(e)}")
        return False

def get_form_config():
    """Get form configuration"""
    print("\n=== Testing Form Configuration ===")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(f"{BASE_URL}/form-config", headers=headers)
        response.raise_for_status()
        
        config = response.json()
        print(f"✅ Form configuration retrieved successfully")
        print(f"   Fields: {len(config.get('fields', []))} fields found")
        
        # Print field names
        field_names = [field.get('name') for field in config.get('fields', [])]
        print(f"   Field names: {', '.join(field_names)}")
        
        return config
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to get form configuration: {str(e)}")
        return None

def create_test_record(additional_fields=None):
    """Create a test storage record"""
    print("\n=== Creating Test Storage Record ===")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Basic record data
    record_data = {
        "full_name": "Test User",
        "phone": "+7 999 123 4567",
        "phone_additional": "+7 999 765 4321",
        "car_brand": "Toyota Camry",
        "parameters": "215/55 R17",
        "size": "4 шт",
        "storage_location": "Бекетова 3а.к15"
    }
    
    # Add any additional fields
    if additional_fields:
        record_data.update(additional_fields)
    
    try:
        response = requests.post(f"{BASE_URL}/storage-records", json=record_data, headers=headers)
        response.raise_for_status()
        
        data = response.json()
        record = data.get("record", {})
        record_id = record.get("record_id")
        
        print(f"✅ Record created successfully")
        print(f"   Record ID: {record_id}")
        print(f"   Record Number: {record.get('record_number')}")
        
        # Check if additional fields were saved
        if additional_fields:
            for key, value in additional_fields.items():
                if key in record and record[key] == value:
                    print(f"   ✅ Additional field '{key}' saved correctly")
                else:
                    print(f"   ❌ Additional field '{key}' not saved correctly")
        
        return record_id, record
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to create record: {str(e)}")
        if hasattr(e, 'response') and e.response:
            print(f"   Response: {e.response.text}")
        return None, None

def download_pdf(record_id):
    """Download PDF for a record"""
    print(f"\n=== Testing PDF Generation for Record {record_id} ===")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(f"{BASE_URL}/storage-records/{record_id}/pdf", headers=headers)
        response.raise_for_status()
        
        # Check if we got a PDF (content type)
        content_type = response.headers.get('Content-Type', '')
        if 'application/pdf' in content_type:
            # Save the PDF to verify it
            pdf_path = f"test_record_{record_id}.pdf"
            with open(pdf_path, 'wb') as f:
                f.write(response.content)
            
            # Check if file was created and has content
            if os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 0:
                print(f"✅ PDF generated successfully")
                print(f"   Saved to: {pdf_path}")
                print(f"   Size: {os.path.getsize(pdf_path)} bytes")
                return True
            else:
                print(f"❌ PDF file empty or not created")
                return False
        else:
            print(f"❌ Response is not a PDF. Content-Type: {content_type}")
            print(f"   Response: {response.text[:200]}...")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to download PDF: {str(e)}")
        if hasattr(e, 'response') and e.response:
            print(f"   Response: {e.response.text[:200]}...")
        return False

def test_retailcrm_status():
    """Test RetailCRM status endpoint"""
    print("\n=== Testing RetailCRM Status ===")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(f"{BASE_URL}/retailcrm/status", headers=headers)
        response.raise_for_status()
        
        data = response.json()
        print(f"✅ RetailCRM status retrieved successfully")
        print(f"   Scheduler running: {data.get('scheduler_running', False)}")
        print(f"   API URL: {data.get('api_url', 'Not set')}")
        print(f"   Synced orders: {data.get('last_sync_orders', 0)}")
        
        return data
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to get RetailCRM status: {str(e)}")
        if hasattr(e, 'response') and e.response:
            print(f"   Response: {e.response.text}")
        return None

def test_retailcrm_sync():
    """Test manual RetailCRM synchronization"""
    print("\n=== Testing RetailCRM Manual Sync ===")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.post(f"{BASE_URL}/retailcrm/sync", headers=headers)
        response.raise_for_status()
        
        data = response.json()
        print(f"✅ RetailCRM manual sync triggered successfully")
        print(f"   Message: {data.get('message', 'No message')}")
        
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to trigger RetailCRM sync: {str(e)}")
        if hasattr(e, 'response') and e.response:
            print(f"   Response: {e.response.text}")
        return False

def main():
    """Main test function"""
    print("Starting backend API tests...")
    
    # Check if API is healthy
    if not check_health():
        print("❌ API health check failed. Aborting tests.")
        return
    
    # Login
    if not login():
        print("❌ Authentication failed. Aborting tests.")
        return
    
    # Test 1: PDF Generation
    print("\n=== TEST 1: PDF Generation ===")
    record_id, _ = create_test_record()
    if record_id:
        pdf_success = download_pdf(record_id)
        if pdf_success:
            print("✅ TEST 1 PASSED: PDF generation works correctly")
        else:
            print("❌ TEST 1 FAILED: PDF generation has issues")
    else:
        print("❌ TEST 1 FAILED: Could not create test record")
    
    # Test 2: Dynamic Form Fields
    print("\n=== TEST 2: Dynamic Form Fields ===")
    form_config = get_form_config()
    if form_config:
        # Create a record with additional custom fields
        additional_fields = {
            "custom_field_1751496388330": "Test Custom Value",
            "custom_note": "This is a test note"
        }
        record_id, record = create_test_record(additional_fields)
        
        if record_id and all(record.get(key) == value for key, value in additional_fields.items()):
            print("✅ TEST 2 PASSED: Dynamic fields are saved correctly")
        else:
            print("❌ TEST 2 FAILED: Dynamic fields not saved correctly")
    else:
        print("❌ TEST 2 FAILED: Could not get form configuration")
    
    # Test 3: RetailCRM Integration
    print("\n=== TEST 3: RetailCRM Integration ===")
    status_data = test_retailcrm_status()
    sync_success = test_retailcrm_sync()
    
    if status_data and sync_success:
        print("✅ TEST 3 PASSED: RetailCRM integration works correctly")
    else:
        print("❌ TEST 3 FAILED: RetailCRM integration has issues")
    
    print("\n=== All Tests Completed ===")

if __name__ == "__main__":
    main()