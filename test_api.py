import requests
import json

endpoints = [
    "/market/crypto",
    "/market/stocks",
    "/market/portfolio",
    "/accounts/",
    "/exchange/rates"
]

ep = "/market/stocks"
try:
    print(f"Testing {ep} with 30s timeout...")
    response = requests.get(f"http://localhost:8000/api/v1{ep}", timeout=30)
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        print(f"Response: {response.text[:200]}")
    else:
        print(f"Detail: {response.text}")
except Exception as e:
    print(f"Error: {e}")
