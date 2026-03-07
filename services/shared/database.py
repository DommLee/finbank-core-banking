"""
FinBank Shared - MongoDB Connection
Used by all microservices for database access.
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
import os

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


async def connect_to_mongo():
    global _client, _db
    url = os.getenv("MONGODB_URL", "mongodb://mongo:27017")
    db_name = os.getenv("MONGODB_DB_NAME", "finbank")

    connect_kwargs = {"host": url}
    if not url.startswith("mongodb+srv"):
        connect_kwargs["directConnection"] = True

    _client = AsyncIOMotorClient(**connect_kwargs)
    _db = _client[db_name]
    return _db


async def close_mongo_connection():
    global _client
    if _client:
        _client.close()


def get_database() -> AsyncIOMotorDatabase:
    return _db


def get_client() -> AsyncIOMotorClient:
    return _client