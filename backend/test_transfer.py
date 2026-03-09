import requests

base_url = "http://127.0.0.1:8000/api/v1"

# 1. Login to get token (assuming test user exists, e.g., customer@finbank.com : password123)
res = requests.post(f"{base_url}/auth/login", json={"email": "customer@finbank.com", "password": "password123"})
if res.status_code != 200:
    print("Login failed:", res.text)
    exit(1)

token = res.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# 2. Get accounts
res = requests.get(f"{base_url}/accounts/", headers=headers)
accounts = res.json()
if len(accounts) < 2:
    print("Need at least 2 accounts to test transfer")
    print(accounts)
    exit(1)

acc1 = accounts[0]["account_id"]
acc2 = accounts[1]["account_id"]

# 3. Transfer
print(f"Transferring 10 from {acc1} to {acc2}")
res = requests.post(
    f"{base_url}/transactions/transfer",
    headers=headers,
    json={
        "from_account_id": acc1,
        "to_account_id": acc2,
        "amount": 10,
        "description": "Test Transfer"
    }
)

print("Status:", res.status_code)
print("Response:", res.text)
