import requests
import time

BASE_URL = "http://localhost:8000/api/v1"

def test_endpoint(path):
    url = f"{BASE_URL}{path}"
    print(f"Testing {url} ...")
    start = time.time()
    try:
        response = requests.get(url, timeout=15)
        duration = time.time() - start
        print(f"Status: {response.status_code}")
        print(f"Time: {duration:.2f}s")
        if response.status_code == 200:
            data = response.json()
            print(f"Count: {len(data)}")
            if len(data) > 0:
                print(f"First item: {data[0]['name']} ({data[0]['symbol']}) - {data[0]['current_price']}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Network Error: {e}")
    print("-" * 30)

print("Diagnostic started at", time.ctime())
test_endpoint("/market/crypto")
test_endpoint("/market/stocks")
test_endpoint("/market/portfolio")
test_endpoint("/exchange/rates")
