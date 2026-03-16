import asyncio
import os
import uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGODB_URL", "mongodb://mongo:27017")
DB_NAME = os.getenv("MONGODB_DB_NAME", "finbank")

async def seed():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    iban = "DGBNK00000001230000000123"
    acc_id = f"MOCK-{iban}"
    
    account_doc = {
        "account_id": acc_id,
        "account_number": "0000123123",
        "iban": iban,
        "customer_id": "MOCK_CUST",
        "user_id": "MOCK_USER",
        "account_type": "current",
        "currency": "TRY",
        "status": "active",
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.accounts.update_one({"iban": iban}, {"$set": account_doc}, upsert=True)
    print(f"Seeded mock external account: {iban}")

if __name__ == "__main__":
    asyncio.run(seed())
