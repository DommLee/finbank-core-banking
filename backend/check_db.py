import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

async def check_accounts():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client[settings.MONGODB_DB_NAME]
    
    accounts = await db.accounts.find({}).to_list(None)
    missing = []
    for acc in accounts:
        if "account_number" not in acc:
            missing.append(acc["account_id"])
    
    print(f"Total accounts: {len(accounts)}")
    print(f"Accounts missing 'account_number': {len(missing)}")
    if missing:
        print("Missing IDs:", missing[:5])

if __name__ == "__main__":
    asyncio.run(check_accounts())
