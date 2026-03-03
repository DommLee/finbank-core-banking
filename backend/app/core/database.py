"""
FinBank Core Banking System - Database Connection (Motor Async MongoDB)
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import settings
import structlog

logger = structlog.get_logger()

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


async def connect_to_mongo():
    """Initialize MongoDB connection and create indexes."""
    global _client, _db
    # directConnection=True only for local Docker (non-SRV)
    connect_kwargs = {"host": settings.MONGODB_URL}
    if not settings.MONGODB_URL.startswith("mongodb+srv"):
        connect_kwargs["directConnection"] = True
    _client = AsyncIOMotorClient(**connect_kwargs)
    _db = _client[settings.MONGODB_DB_NAME]

    # ── Create Indexes ──
    # Users: unique email
    await _db.users.create_index("email", unique=True)

    # Customers: unique national_id, index on user_id
    await _db.customers.create_index("national_id", unique=True)
    await _db.customers.create_index("user_id")

    # Accounts: unique account_number, index on customer_id
    await _db.accounts.create_index("account_number", unique=True)
    await _db.accounts.create_index("customer_id")

    # Ledger: composite unique for idempotency, index on account_id
    await _db.ledger_entries.create_index(
        [("transaction_ref", 1), ("account_id", 1), ("type", 1)],
        unique=True,
    )
    await _db.ledger_entries.create_index("account_id")
    await _db.ledger_entries.create_index("created_at")

    # Audit logs: indexes for querying
    await _db.audit_logs.create_index("timestamp")
    await _db.audit_logs.create_index("user_id")
    await _db.audit_logs.create_index("action")

    # ── MongoDB Schema Validation for ledger_entries (append-only enforcement) ──
    try:
        await _db.command({
            "collMod": "ledger_entries",
            "validator": {
                "$jsonSchema": {
                    "bsonType": "object",
                    "required": [
                        "entry_id", "account_id", "type", "category",
                        "amount", "transaction_ref", "created_at", "created_by"
                    ],
                    "properties": {
                        "entry_id": {"bsonType": "string"},
                        "account_id": {"bsonType": "string"},
                        "type": {"enum": ["DEBIT", "CREDIT"]},
                        "category": {
                            "enum": [
                                "DEPOSIT", "WITHDRAWAL",
                                "TRANSFER_IN", "TRANSFER_OUT"
                            ]
                        },
                        "amount": {"bsonType": ["decimal", "double", "int"]},
                        "transaction_ref": {"bsonType": "string"},
                        "description": {"bsonType": "string"},
                        "created_at": {"bsonType": "date"},
                        "created_by": {"bsonType": "string"},
                    }
                }
            },
            "validationLevel": "strict",
        })
    except Exception:
        # Collection might not exist yet, create it
        await _db.create_collection(
            "ledger_entries",
            validator={
                "$jsonSchema": {
                    "bsonType": "object",
                    "required": [
                        "entry_id", "account_id", "type", "category",
                        "amount", "transaction_ref", "created_at", "created_by"
                    ],
                }
            },
        )

    logger.info("Connected to MongoDB", db=settings.MONGODB_DB_NAME)


async def close_mongo_connection():
    """Close MongoDB connection."""
    global _client
    if _client:
        _client.close()
        logger.info("Closed MongoDB connection")


def get_database() -> AsyncIOMotorDatabase:
    """Get database instance (dependency)."""
    return _db


def get_client() -> AsyncIOMotorClient:
    """Get client instance (for transactions)."""
    return _client


# Alias for modules that import get_db
get_db = get_database
