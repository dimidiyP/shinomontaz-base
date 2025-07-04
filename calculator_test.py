import requests
import unittest
import sys
import json
import uuid
from datetime import datetime

class TireCalculatorAPITester(unittest.TestCase):
    def __init__(self, *args, **kwargs):
        super(TireCalculatorAPITester, self).__init__(*args, **kwargs)
        # Get the backend URL from frontend/.env
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    self.base_url = line.strip().split('=')[1].strip('"\'')
                    break
        print(f"Using backend URL: {self.base_url}")
        
    # Class variable to store the saved result ID
    saved_result_id = None

    def test_1_get_passenger_settings(self):
        """Test getting calculator settings for passenger vehicles"""
        print("\n🔍 Testing Get Passenger Calculator Settings...")
        
        response = requests.get(f"{self.base_url}/api/calculator/settings/passenger")
        
        self.assertEqual(response.status_code, 200, f"Failed to get passenger settings: {response.text if response.status_code != 200 else ''}")
        data = response.json()
        
        # Verify the structure of the response
        self.assertEqual(data["vehicle_type"], "passenger", "Vehicle type is not 'passenger'")
        self.assertIn("hourly_rate", data, "Hourly rate not found in settings")
        self.assertIn("services", data, "Services not found in settings")
        self.assertIn("additional_options", data, "Additional options not found in settings")
        
        # Verify services contain required fields
        for service in data["services"]:
            self.assertIn("id", service, "Service ID not found")
            self.assertIn("name", service, "Service name not found")
            self.assertIn("time_by_size", service, "Time by size not found")
            self.assertIn("enabled", service, "Enabled flag not found")
        
        # Verify additional options contain required fields
        for option in data["additional_options"]:
            self.assertIn("id", option, "Option ID not found")
            self.assertIn("name", option, "Option name not found")
            self.assertIn("time_multiplier", option, "Time multiplier not found")
        
        print(f"✅ Passenger calculator settings retrieved successfully")
        print(f"✅ Hourly rate: {data['hourly_rate']} rubles")
        print(f"✅ Services count: {len(data['services'])}")
        print(f"✅ Additional options count: {len(data['additional_options'])}")
        return True

    def test_2_get_truck_settings(self):
        """Test getting calculator settings for truck vehicles"""
        print("\n🔍 Testing Get Truck Calculator Settings...")
        
        response = requests.get(f"{self.base_url}/api/calculator/settings/truck")
        
        self.assertEqual(response.status_code, 200, f"Failed to get truck settings: {response.text if response.status_code != 200 else ''}")
        data = response.json()
        
        # Verify the structure of the response
        self.assertEqual(data["vehicle_type"], "truck", "Vehicle type is not 'truck'")
        self.assertIn("hourly_rate", data, "Hourly rate not found in settings")
        self.assertIn("services", data, "Services not found in settings")
        self.assertIn("additional_options", data, "Additional options not found in settings")
        
        # Verify services contain required fields
        for service in data["services"]:
            self.assertIn("id", service, "Service ID not found")
            self.assertIn("name", service, "Service name not found")
            self.assertIn("time_by_size", service, "Time by size not found")
            self.assertIn("enabled", service, "Enabled flag not found")
        
        # Verify additional options contain required fields
        for option in data["additional_options"]:
            self.assertIn("id", option, "Option ID not found")
            self.assertIn("name", option, "Option name not found")
            self.assertIn("time_multiplier", option, "Time multiplier not found")
        
        print(f"✅ Truck calculator settings retrieved successfully")
        print(f"✅ Hourly rate: {data['hourly_rate']} rubles")
        print(f"✅ Services count: {len(data['services'])}")
        print(f"✅ Additional options count: {len(data['additional_options'])}")
        return True

    def test_3_calculate_passenger_cost(self):
        """Test calculating cost for passenger vehicle services"""
        print("\n🔍 Testing Calculate Passenger Cost...")
        
        # Prepare calculation request for passenger vehicle
        # Scenario 1: Легковой автомобиль, размер R16, 4 колеса, услуги ["mount_demount", "balancing"]
        calculation_data = {
            "vehicle_type": "passenger",
            "tire_size": "R16",
            "wheel_count": 4,
            "selected_services": ["mount_demount", "balancing"],
            "additional_options": []
        }
        
        response = requests.post(
            f"{self.base_url}/api/calculator/calculate", 
            json=calculation_data
        )
        
        self.assertEqual(response.status_code, 200, f"Failed to calculate cost: {response.text if response.status_code != 200 else ''}")
        data = response.json()
        
        # Verify the structure of the response
        self.assertEqual(data["vehicle_type"], "passenger", "Vehicle type is not 'passenger'")
        self.assertEqual(data["tire_size"], "R16", "Tire size is not 'R16'")
        self.assertEqual(data["wheel_count"], 4, "Wheel count is not 4")
        self.assertListEqual(data["selected_services"], ["mount_demount", "balancing"], "Selected services do not match")
        self.assertIn("total_time", data, "Total time not found in response")
        self.assertIn("total_cost", data, "Total cost not found in response")
        self.assertIn("breakdown", data, "Breakdown not found in response")
        
        # Verify the calculation is correct
        # For R16: mount_demount = 20 min, balancing = 10 min
        # Total time per wheel = 30 min
        # Total time for 4 wheels = 120 min
        # Cost = (120 / 60) * hourly_rate
        expected_time = 120  # 4 wheels * (20 + 10) minutes
        
        # Get the hourly rate from settings
        settings_response = requests.get(f"{self.base_url}/api/calculator/settings/passenger")
        settings = settings_response.json()
        hourly_rate = settings["hourly_rate"]
        
        expected_cost = int((expected_time / 60) * hourly_rate)
        
        self.assertEqual(data["total_time"], expected_time, f"Total time {data['total_time']} does not match expected {expected_time}")
        self.assertEqual(data["total_cost"], expected_cost, f"Total cost {data['total_cost']} does not match expected {expected_cost}")
        
        print(f"✅ Passenger cost calculation successful")
        print(f"✅ Total time: {data['total_time']} minutes")
        print(f"✅ Total cost: {data['total_cost']} rubles")
        print(f"✅ Hourly rate used: {hourly_rate} rubles")
        return True

    def test_4_calculate_truck_cost_with_options(self):
        """Test calculating cost for truck vehicle services with additional options"""
        print("\n🔍 Testing Calculate Truck Cost with Options...")
        
        # Prepare calculation request for truck vehicle
        # Scenario 2: Грузовой автомобиль, размер R22.5, 2 колеса, услуги ["mount_demount"], опции ["heavy_duty"]
        calculation_data = {
            "vehicle_type": "truck",
            "tire_size": "R22.5",
            "wheel_count": 2,
            "selected_services": ["mount_demount"],
            "additional_options": ["heavy_duty"]
        }
        
        response = requests.post(
            f"{self.base_url}/api/calculator/calculate", 
            json=calculation_data
        )
        
        self.assertEqual(response.status_code, 200, f"Failed to calculate cost: {response.text if response.status_code != 200 else ''}")
        data = response.json()
        
        # Verify the structure of the response
        self.assertEqual(data["vehicle_type"], "truck", "Vehicle type is not 'truck'")
        self.assertEqual(data["tire_size"], "R22.5", "Tire size is not 'R22.5'")
        self.assertEqual(data["wheel_count"], 2, "Wheel count is not 2")
        self.assertListEqual(data["selected_services"], ["mount_demount"], "Selected services do not match")
        self.assertListEqual(data["additional_options"], ["heavy_duty"], "Additional options do not match")
        self.assertIn("total_time", data, "Total time not found in response")
        self.assertIn("total_cost", data, "Total cost not found in response")
        self.assertIn("breakdown", data, "Breakdown not found in response")
        
        # Verify the calculation is correct
        # For R22.5: mount_demount = 60 min
        # Total time per wheel = 60 min
        # Total time for 2 wheels = 120 min
        # With heavy_duty option (multiplier 1.3): 120 * 1.3 = 156 min
        # Cost = (156 / 60) * hourly_rate
        
        # Get the settings to verify the calculation
        settings_response = requests.get(f"{self.base_url}/api/calculator/settings/truck")
        settings = settings_response.json()
        hourly_rate = settings["hourly_rate"]
        
        # Find the mount_demount service time for R22.5
        mount_demount_time = 0
        for service in settings["services"]:
            if service["id"] == "mount_demount":
                mount_demount_time = service["time_by_size"]["R22.5"]
                break
        
        # Find the heavy_duty option multiplier
        heavy_duty_multiplier = 0
        for option in settings["additional_options"]:
            if option["id"] == "heavy_duty":
                heavy_duty_multiplier = option["time_multiplier"]
                break
        
        base_time = mount_demount_time * 2  # 2 wheels
        expected_time = int(base_time * heavy_duty_multiplier)
        expected_cost = int((expected_time / 60) * hourly_rate)
        
        self.assertEqual(data["breakdown"]["base_time"], base_time, f"Base time {data['breakdown']['base_time']} does not match expected {base_time}")
        self.assertEqual(data["breakdown"]["multiplier"], heavy_duty_multiplier, f"Multiplier {data['breakdown']['multiplier']} does not match expected {heavy_duty_multiplier}")
        self.assertEqual(data["total_time"], expected_time, f"Total time {data['total_time']} does not match expected {expected_time}")
        self.assertEqual(data["total_cost"], expected_cost, f"Total cost {data['total_cost']} does not match expected {expected_cost}")
        
        print(f"✅ Truck cost calculation with options successful")
        print(f"✅ Base time: {base_time} minutes")
        print(f"✅ Multiplier: {heavy_duty_multiplier}")
        print(f"✅ Total time: {data['total_time']} minutes")
        print(f"✅ Total cost: {data['total_cost']} rubles")
        print(f"✅ Hourly rate used: {hourly_rate} rubles")
        return True

    def test_5_save_calculation_result(self):
        """Test saving calculation result"""
        print("\n🔍 Testing Save Calculation Result...")
        
        # Prepare calculation request
        calculation_data = {
            "vehicle_type": "passenger",
            "tire_size": "R17",
            "wheel_count": 4,
            "selected_services": ["mount_demount", "balancing", "wheel_remove_install"],
            "additional_options": ["low_profile"]
        }
        
        response = requests.post(
            f"{self.base_url}/api/calculator/save-result", 
            json=calculation_data
        )
        
        self.assertEqual(response.status_code, 200, f"Failed to save calculation result: {response.text if response.status_code != 200 else ''}")
        data = response.json()
        
        # Verify the structure of the response
        self.assertIn("unique_id", data, "Unique ID not found in response")
        self.assertIn("calculation", data, "Calculation not found in response")
        
        # Save the unique ID for the next test
        self.saved_result_id = data["unique_id"]
        
        print(f"✅ Calculation result saved successfully")
        print(f"✅ Unique ID: {self.saved_result_id}")
        return True

    def test_6_get_saved_calculation(self):
        """Test getting saved calculation result"""
        print("\n🔍 Testing Get Saved Calculation Result...")
        
        if not self.saved_result_id:
            print("⚠️ No saved result ID available, skipping test")
            return False
        
        response = requests.get(f"{self.base_url}/api/calculator/result/{self.saved_result_id}")
        
        self.assertEqual(response.status_code, 200, f"Failed to get saved calculation result: {response.text if response.status_code != 200 else ''}")
        data = response.json()
        
        # Verify the structure of the response
        self.assertIn("unique_id", data, "Unique ID not found in response")
        self.assertEqual(data["unique_id"], self.saved_result_id, "Unique ID does not match")
        self.assertIn("calculation", data, "Calculation not found in response")
        self.assertIn("created_at", data, "Created at timestamp not found")
        
        # Verify the calculation data
        calculation = data["calculation"]
        self.assertEqual(calculation["vehicle_type"], "passenger", "Vehicle type is not 'passenger'")
        self.assertEqual(calculation["tire_size"], "R17", "Tire size is not 'R17'")
        self.assertEqual(calculation["wheel_count"], 4, "Wheel count is not 4")
        self.assertListEqual(calculation["selected_services"], ["mount_demount", "balancing", "wheel_remove_install"], "Selected services do not match")
        self.assertListEqual(calculation["additional_options"], ["low_profile"], "Additional options do not match")
        
        print(f"✅ Saved calculation result retrieved successfully")
        print(f"✅ Unique ID: {data['unique_id']}")
        print(f"✅ Total time: {calculation['total_time']} minutes")
        print(f"✅ Total cost: {calculation['total_cost']} rubles")
        return True

def run_tests():
    # Create test suite
    suite = unittest.TestSuite()
    tester = TireCalculatorAPITester()
    
    # Add tests in order
    suite.addTest(TireCalculatorAPITester('test_1_get_passenger_settings'))
    suite.addTest(TireCalculatorAPITester('test_2_get_truck_settings'))
    suite.addTest(TireCalculatorAPITester('test_3_calculate_passenger_cost'))
    suite.addTest(TireCalculatorAPITester('test_4_calculate_truck_cost_with_options'))
    suite.addTest(TireCalculatorAPITester('test_5_save_calculation_result'))
    suite.addTest(TireCalculatorAPITester('test_6_get_saved_calculation'))
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Print summary
    print(f"\n📊 Tests passed: {result.testsRun - len(result.errors) - len(result.failures)}/{result.testsRun}")
    
    # Return exit code
    return 0 if result.wasSuccessful() else 1

if __name__ == "__main__":
    sys.exit(run_tests())