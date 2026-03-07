import asyncio
import os
import motor.motor_asyncio

db = motor.motor_asyncio.AsyncIOMotorClient(
    os.getenv("MONGODB_URL", "mongodb://localhost:27017")
)[os.getenv("MONGODB_DB_NAME", "finbank")]

async def main():
    customers = await db.customers.find({'status': 'pending'}).to_list(100)
    print(f'Pending customers: {len(customers)}')
    for c in customers[:5]:
        print(c.get('full_name'), c.get('status'), c.get('kyc_verified'))
        
    users = await db.users.find({'kyc_status': 'PENDING'}).to_list(100)
    print(f'Pending users: {len(users)}')
    for u in users[:5]:
        print(u.get('email'), u.get('kyc_status'))

asyncio.run(main())