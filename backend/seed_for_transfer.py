import asyncio
import os
import uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# ENV
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
MONGO_URL = os.getenv("MONGODB_URL", "mongodb://mongo:27017")
DB_NAME = os.getenv("MONGODB_DB_NAME", "finbank")

async def seed():
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    users_to_seed = [
        {"email": "test1@finbank.com", "password": "Password123!", "full_name": "Test User One"},
        {"email": "test2@finbank.com", "password": "Password123!", "full_name": "Test User Two"}
    ]
    
    for u_data in users_to_seed:
        email = u_data["email"]
        password = u_data["password"]
        
        # 1. Supabase Auth
        try:
            res = supabase.auth.admin.create_user({
                "email": email,
                "password": password,
                "email_confirm": True
            })
            user_id = res.user.id
            print(f"Created Supabase user: {email} ({user_id})")
        except Exception as e:
            # Maybe already exists, try to get ID
            try:
                # Search by email isn't directly in admin client easily without list_users
                all_users = supabase.auth.admin.list_users()
                user = next((u for u in all_users if u.email == email), None)
                if user:
                    user_id = user.id
                    print(f"Using existing Supabase user: {email} ({user_id})")
                else:
                    raise e
            except:
                print(f"Error seeding {email}: {e}")
                continue

        # 2. Mongo User
        user_doc = {
            "user_id": user_id,
            "email": email,
            "role": "customer",
            "is_active": True,
            "kyc_status": "APPROVED",
            "created_at": datetime.now(timezone.utc)
        }
        await db.users.update_one({"user_id": user_id}, {"$set": user_doc}, upsert=True)
        
        # 3. Mongo Customer
        customer_id = str(uuid.uuid4())
        customer_doc = {
            "customer_id": customer_id,
            "user_id": user_id,
            "full_name": u_data["full_name"],
            "national_id": "".join([str(os.urandom(1)[0] % 10) for _ in range(11)]),
            "status": "active",
            "created_at": datetime.now(timezone.utc)
        }
        # Use existing if possible to avoid dupes
        existing_cust = await db.customers.find_one({"user_id": user_id})
        if existing_cust:
            customer_id = existing_cust["customer_id"]
        else:
            await db.customers.insert_one(customer_doc)
            
        # 4. Mongo Account
        import random
        acc_id = str(uuid.uuid4())
        acc_num = f"{random.randint(1000000000, 9999999999)}"
        # Mock IBAN: FINB + 2-digit check + 6-digit bank code (000619) + 14-digit account part
        iban = f"FINB{random.randint(10,99)}000619{acc_num.zfill(14)}"
        
        account_doc = {
            "account_id": acc_id,
            "account_number": acc_num,
            "iban": iban,
            "customer_id": customer_id,
            "user_id": user_id,
            "account_type": "savings",
            "currency": "TRY",
            "status": "active",
            "created_at": datetime.now(timezone.utc)
        }
        
        existing_acc = await db.accounts.find_one({"user_id": user_id})
        if not existing_acc:
            await db.accounts.insert_one(account_doc)
            print(f"Created Account for {email}: {iban}")
            target_acc_id = acc_id
        else:
            print(f"Account already exists for {email}: {existing_acc['iban']}")
            target_acc_id = existing_acc["account_id"]
            
        # 5. Ledger (Seed Balance - Always ensure they have money)
        from app.services.ledger_service import LedgerService
        ledger = LedgerService(db)
        balance = await ledger.get_balance(target_acc_id)
        if balance < 500:
            ledger_entry = {
                "entry_id": f"LED-{uuid.uuid4().hex[:8].upper()}",
                "account_id": target_acc_id,
                "type": "CREDIT",
                "category": "DEPOSIT",
                "amount": 1000.0,
                "transaction_ref": f"SEED-{uuid.uuid4().hex[:6].upper()}",
                "description": "Refill Seed Balance",
                "created_at": datetime.now(timezone.utc),
                "created_by": "system"
            }
            await db.ledger_entries.insert_one(ledger_entry)
            print(f"Added 1000.0 to {target_acc_id}")

if __name__ == "__main__":
    asyncio.run(seed())
