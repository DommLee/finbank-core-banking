"""
FinBank - Ledger Service (Single Source of Truth)
Append-only financial ledger. Balance is always computed, never stored.
"""
import uuid
import structlog
from datetime import datetime, timezone
from typing import Optional, List
from bson import Decimal128
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorClientSession
from app.core.exceptions import InsufficientFundsError
from app.services.supabase_sync import sync_transaction

logger = structlog.get_logger()


class LedgerService:
    """Manages append-only ledger entries and balance computation."""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.ledger_entries

    def _generate_entry_id(self) -> str:
        """Generate a unique ledger entry ID."""
        return f"LED-{uuid.uuid4().hex[:8].upper()}"

    async def get_balance(self, account_id: str) -> float:
        """
        Compute account balance by aggregating all ledger entries.
        Balance is NEVER stored — always computed from the ledger.
        """
        pipeline = [
            {"$match": {"account_id": account_id}},
            {"$group": {"_id": None, "balance": {"$sum": "$amount"}}},
        ]
        result = await self.collection.aggregate(pipeline).to_list(1)
        if result:
            balance = result[0]["balance"]
            # Handle Decimal128
            if isinstance(balance, Decimal128):
                return float(str(balance))
            return float(balance)
        return 0.0

    async def append_entry(
        self,
        account_id: str,
        entry_type: str,
        category: str,
        amount: float,
        transaction_ref: str,
        created_by: str,
        description: str = "",
        session: Optional[AsyncIOMotorClientSession] = None,
    ) -> dict:
        """
        Append a single ledger entry. This is the ONLY way to modify balances.
        No UPDATE or DELETE operations are ever performed on ledger_entries.
        """
        entry = {
            "entry_id": self._generate_entry_id(),
            "account_id": account_id,
            "type": entry_type,
            "category": category,
            "amount": amount,
            "transaction_ref": transaction_ref,
            "description": description,
            "created_at": datetime.now(timezone.utc),
            "created_by": created_by,
        }

        await self.collection.insert_one(entry, session=session)
        # Synchronize credit card limits if applicable
        acc = await self.db.accounts.find_one({"account_id": account_id})
        if acc and acc.get("account_type") == "credit":
            card_id = acc.get("card_id")
            if card_id:
                curr_balance = await self.get_balance(account_id)
                max_limit = acc.get("overdraft_limit", 0)
                debt = -curr_balance if curr_balance < 0 else 0
                available = max_limit + curr_balance
                await self.db.credit_cards.update_one(
                    {"id": card_id},
                    {"$set": {"current_debt": float(debt), "available_limit": float(available), "updated_at": datetime.now(timezone.utc)}}
                )

        # Fire-and-forget sync to Supabase
        try:
            await sync_transaction(entry)
        except Exception:
            pass
        logger.info(
            "Ledger entry appended",
            entry_id=entry["entry_id"],
            account_id=account_id,
            type=entry_type,
            amount=amount,
            ref=transaction_ref,
        )
        return entry

    async def deposit(
        self,
        account_id: str,
        amount: float,
        created_by: str,
        description: str = "Deposit",
    ) -> dict:
        """Record a deposit via ledger entry (CREDIT)."""
        txn_ref = f"DEP-{uuid.uuid4().hex[:8].upper()}"
        return await self.append_entry(
            account_id=account_id,
            entry_type="CREDIT",
            category="DEPOSIT",
            amount=amount,
            transaction_ref=txn_ref,
            created_by=created_by,
            description=description,
        )

    async def withdraw(
        self,
        account_id: str,
        amount: float,
        created_by: str,
        description: str = "Withdrawal",
    ) -> dict:
        """Record a withdrawal via ledger entry (DEBIT)."""
        # Check balance first
        balance = await self.get_balance(account_id)
        
        # Check overdraft limit
        acc = await self.db.accounts.find_one({"account_id": account_id})
        overdraft_limit = acc.get("overdraft_limit", 0.0) if acc else 0.0
        
        if balance + overdraft_limit < amount:
            raise InsufficientFundsError()

        txn_ref = f"WDR-{uuid.uuid4().hex[:8].upper()}"
        return await self.append_entry(
            account_id=account_id,
            entry_type="DEBIT",
            category="WITHDRAWAL",
            amount=-amount,
            transaction_ref=txn_ref,
            created_by=created_by,
            description=description,
        )

    async def execute_transfer(
        self,
        from_account_id: str,
        to_account_id: str,
        amount: float,
        created_by: str,
        description: str = "Internal Transfer",
    ) -> str:
        """
        Execute a transfer using MongoDB multi-document transaction.
        Both debit and credit are atomically committed.
        Returns the transaction reference.
        """
        # Check balance before starting transaction
        balance = await self.get_balance(from_account_id)
        
        acc = await self.db.accounts.find_one({"account_id": from_account_id})
        overdraft_limit = acc.get("overdraft_limit", 0.0) if acc else 0.0
        
        if balance + overdraft_limit < amount:
            raise InsufficientFundsError()

        txn_ref = f"TXN-{uuid.uuid4().hex[:8].upper()}"

        # Use MongoDB transaction for atomicity
        async with await self.db.client.start_session() as session:
            async def _txn_body(s: AsyncIOMotorClientSession):
                # Debit the source account
                await self.append_entry(
                    account_id=from_account_id,
                    entry_type="DEBIT",
                    category="TRANSFER_OUT",
                    amount=-amount,
                    transaction_ref=txn_ref,
                    created_by=created_by,
                    description=f"Transfer to {to_account_id}: {description}",
                    session=s,
                )

                # Credit the target account
                await self.append_entry(
                    account_id=to_account_id,
                    entry_type="CREDIT",
                    category="TRANSFER_IN",
                    amount=amount,
                    transaction_ref=txn_ref,
                    created_by=created_by,
                    description=f"Transfer from {from_account_id}: {description}",
                    session=s,
                )

            await session.with_transaction(_txn_body)

        logger.info(
            "Transfer executed",
            txn_ref=txn_ref,
            from_account=from_account_id,
            to_account=to_account_id,
            amount=amount,
        )
        return txn_ref

    async def get_entries(
        self,
        account_id: Optional[str] = None,
        entry_type: Optional[str] = None,
        category: Optional[str] = None,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[List[dict], int]:
        """Query ledger entries with filtering and pagination."""
        query = {}
        if account_id:
            query["account_id"] = account_id
        if entry_type:
            query["type"] = entry_type
        if category:
            query["category"] = category
        if from_date or to_date:
            date_filter = {}
            if from_date:
                date_filter["$gte"] = from_date
            if to_date:
                date_filter["$lte"] = to_date
            query["created_at"] = date_filter

        total = await self.collection.count_documents(query)
        cursor = (
            self.collection.find(query)
            .sort("created_at", -1)
            .skip(skip)
            .limit(limit)
        )
        entries = await cursor.to_list(limit)

        # Convert ObjectId to string
        for entry in entries:
            entry["_id"] = str(entry["_id"])

        return entries, total
