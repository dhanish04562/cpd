import requests
import sys
import json
from datetime import datetime

class CPDSystemTester:
    def __init__(self, base_url="https://royal-cpd-discount.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_investors = []
        self.created_sellers = []
        self.created_transactions = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json() if response.text else {}
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"username": "admin", "password": "admin123"}
        )
        if success and 'access_token' in response:
            self.token = response['access_token']
            print(f"   Token obtained: {self.token[:20]}...")
            return True
        return False

    def test_dashboard_stats(self):
        """Test dashboard stats endpoint"""
        success, response = self.run_test(
            "Dashboard Stats",
            "GET",
            "dashboard/stats",
            200
        )
        if success:
            print(f"   Pool: {response.get('pool', {})}")
            print(f"   Investors: {response.get('total_investors', 0)}")
            print(f"   Sellers: {response.get('total_sellers', 0)}")
        return success

    def test_create_investor(self, name, email, phone, contribution):
        """Create an investor"""
        investor_data = {
            "name": name,
            "email": email,
            "phone": phone,
            "contribution_amount": contribution
        }
        success, response = self.run_test(
            f"Create Investor - {name}",
            "POST",
            "investors",
            200,
            data=investor_data
        )
        if success and 'id' in response:
            self.created_investors.append(response['id'])
            print(f"   Investor ID: {response['id']}")
        return success, response

    def test_get_investors(self):
        """Get all investors"""
        success, response = self.run_test(
            "Get Investors",
            "GET",
            "investors",
            200
        )
        if success:
            print(f"   Found {len(response)} investors")
        return success, response

    def test_create_seller(self, name, contact_person, phone, payment_terms, discount_pct):
        """Create a seller"""
        seller_data = {
            "name": name,
            "contact_person": contact_person,
            "phone": phone,
            "payment_terms_days": payment_terms,
            "discount_percentage": discount_pct
        }
        success, response = self.run_test(
            f"Create Seller - {name}",
            "POST",
            "sellers",
            200,
            data=seller_data
        )
        if success and 'id' in response:
            self.created_sellers.append(response['id'])
            print(f"   Seller ID: {response['id']}")
        return success, response

    def test_get_sellers(self):
        """Get all sellers"""
        success, response = self.run_test(
            "Get Sellers",
            "GET",
            "sellers",
            200
        )
        if success:
            print(f"   Found {len(response)} sellers")
        return success, response

    def test_create_transaction(self, seller_id, amount_paid, invoice_number):
        """Create a transaction"""
        transaction_data = {
            "seller_id": seller_id,
            "amount_paid": amount_paid,
            "invoice_number": invoice_number,
            "notes": f"Test transaction for {invoice_number}"
        }
        success, response = self.run_test(
            f"Create Transaction - {invoice_number}",
            "POST",
            "transactions",
            200,
            data=transaction_data
        )
        if success and 'id' in response:
            self.created_transactions.append(response['id'])
            print(f"   Transaction ID: {response['id']}")
            print(f"   Discount: ₹{response.get('discount_received', 0)}")
            print(f"   Investor Share (70%): ₹{response.get('investor_share', 0)}")
            print(f"   Shop Share (30%): ₹{response.get('shop_share', 0)}")
        return success, response

    def test_get_transactions(self):
        """Get all transactions"""
        success, response = self.run_test(
            "Get Transactions",
            "GET",
            "transactions",
            200
        )
        if success:
            print(f"   Found {len(response)} transactions")
        return success, response

    def test_settle_transaction(self, transaction_id):
        """Settle a transaction"""
        success, response = self.run_test(
            f"Settle Transaction - {transaction_id}",
            "POST",
            "transactions/settle",
            200,
            data={"transaction_id": transaction_id}
        )
        return success, response

    def test_investor_returns(self):
        """Get investor returns report"""
        success, response = self.run_test(
            "Investor Returns Report",
            "GET",
            "reports/investor-returns",
            200
        )
        if success:
            print(f"   Found {len(response)} investor records")
            for inv in response:
                print(f"   {inv.get('name', 'Unknown')}: ₹{inv.get('total_returns', 0)} returns")
        return success, response

    def test_remove_investor(self, investor_id):
        """Remove an investor"""
        success, response = self.run_test(
            f"Remove Investor - {investor_id}",
            "DELETE",
            f"investors/{investor_id}",
            200
        )
        return success, response

    def test_insufficient_funds_scenario(self, seller_id):
        """Test insufficient funds error handling"""
        # Try to create a transaction with very large amount
        large_amount = 10000000  # 1 crore
        success, response = self.run_test(
            "Insufficient Funds Test",
            "POST",
            "transactions",
            400,  # Expecting 400 error
            data={
                "seller_id": seller_id,
                "amount_paid": large_amount,
                "invoice_number": "LARGE_TXN_001",
                "notes": "Testing insufficient funds"
            }
        )
        return success

def main():
    print("🚀 Starting CPD System Backend Testing")
    print("=" * 50)
    
    tester = CPDSystemTester()
    
    # Test authentication
    if not tester.test_login():
        print("❌ Authentication failed, stopping tests")
        return 1

    # Test dashboard
    tester.test_dashboard_stats()

    # Test investor management
    print("\n📊 Testing Investor Management")
    print("-" * 30)
    
    # Create test investors
    tester.test_create_investor("Rajesh Kumar", "rajesh@example.com", "+91-9876543210", 100000)
    tester.test_create_investor("Priya Sharma", "priya@example.com", "+91-9876543211", 150000)
    tester.test_create_investor("Amit Patel", "amit@example.com", "+91-9876543212", 200000)
    
    # Get investors
    tester.test_get_investors()

    # Test seller management
    print("\n🏪 Testing Seller Management")
    print("-" * 30)
    
    # Create test sellers
    tester.test_create_seller("Saree Palace", "Mohan Das", "+91-9876543220", 120, 8.5)
    tester.test_create_seller("Royal Textiles", "Sunita Devi", "+91-9876543221", 100, 10.0)
    tester.test_create_seller("Fashion Hub", "Ravi Singh", "+91-9876543222", 180, 7.5)
    
    # Get sellers
    tester.test_get_sellers()

    # Test transaction management
    print("\n💰 Testing Transaction Management")
    print("-" * 30)
    
    if tester.created_sellers:
        # Create transactions with different sellers
        tester.test_create_transaction(tester.created_sellers[0], 50000, "INV-001")
        tester.test_create_transaction(tester.created_sellers[1], 75000, "INV-002")
        
        # Get transactions
        tester.test_get_transactions()
        
        # Test settlement
        if tester.created_transactions:
            tester.test_settle_transaction(tester.created_transactions[0])
        
        # Test insufficient funds scenario
        tester.test_insufficient_funds_scenario(tester.created_sellers[0])

    # Test reports
    print("\n📈 Testing Reports")
    print("-" * 30)
    
    tester.test_investor_returns()

    # Test investor removal
    print("\n🗑️ Testing Investor Removal")
    print("-" * 30)
    
    if tester.created_investors:
        tester.test_remove_investor(tester.created_investors[-1])  # Remove last investor

    # Final dashboard check
    print("\n📊 Final Dashboard Check")
    print("-" * 30)
    tester.test_dashboard_stats()

    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"❌ {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())