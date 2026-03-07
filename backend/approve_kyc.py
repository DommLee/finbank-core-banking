import asyncio
import os
import motor.motor_asyncio
from app.services.supabase_sync import sync_user

db = motor.motor_asyncio.AsyncIOMotorClient(
    os.getenv("MONGODB_URL", "mongodb://mongo:27017")
)[os.getenv("MONGODB_DB_NAME", "finbank")]

async def main():
    # Find active customers
    cursor = db.customers.find({"status": "active"})
    active_customers = await cursor.to_list(1000)
    
    fixed_count = 0
    for c in active_customers:
        user_id = c.get("user_id")
        user = await db.users.find_one({"user_id": user_id})
        if user and user.get("kyc_status") != "APPROVED":
            await db.users.update_one({"user_id": user_id}, {"$set": {"kyc_status": "APPROVED"}})
            updated_user = await db.users.find_one({"user_id": user_id})
            await sync_user(updated_user)
            print(f"Fixed user {user.get('email')}")
            fixed_count += 1
            
    # Find rejected customers
    cursor = db.customers.find({"status": "suspended"})
    suspended_customers = await cursor.to_list(1000)
    
    for c in suspended_customers:
        user_id = c.get("user_id")
        user = await db.users.find_one({"user_id": user_id})
        if user and user.get("kyc_status") not in ["REJECTED", "SUSPENDED"]:
            await db.users.update_one({"user_id": user_id}, {"$set": {"kyc_status": "REJECTED"}})
            updated_user = await db.users.find_one({"user_id": user_id})
            await sync_user(updated_user)
            print(f"Fixed suspended user {user.get('email')}")
            fixed_count += 1
            
    print(f"Total users fixed: {fixed_count}")

asyncio.run(main())