# FinBank — Database Schema & Validation

## MongoDB Collections

### 1. `users`
Stores authentication and role information.

```json
{
  "_id": "ObjectId",
  "user_id": "string (UUID)",
  "email": "string (unique)",
  "full_name": "string",
  "role": "enum: customer | employee | admin | ceo",
  "is_active": "boolean (default: true)",
  "created_at": "datetime (UTC)"
}
```

**Indexes:**
- Unique index on `email`
- Index on `user_id`

---

### 2. `customers`
KYC profile data linked to a user.

```json
{
  "_id": "ObjectId",
  "customer_id": "string (CUS-XXXXXXXX)",
  "user_id": "string (FK → users)",
  "first_name": "string",
  "last_name": "string",
  "national_id": "string (11 digits, Turkish TC)",
  "phone": "string",
  "address": "string (optional)",
  "kyc_status": "enum: pending | approved | rejected",
  "created_at": "datetime (UTC)"
}
```

**Indexes:**
- Unique index on `user_id`
- Unique index on `national_id`

---

### 3. `accounts`
Bank accounts with IBAN.

```json
{
  "_id": "ObjectId",
  "account_id": "string (ACC-XXXXXXXX)",
  "customer_id": "string (FK → customers)",
  "user_id": "string (FK → users)",
  "account_type": "enum: checking | savings | business | credit",
  "currency": "string (ISO 4217: TRY, USD, EUR)",
  "iban": "string (TR + 24 digits)",
  "status": "enum: active | frozen | closed",
  "created_at": "datetime (UTC)"
}
```

**Indexes:**
- Unique index on `account_id`
- Unique index on `iban`
- Index on `user_id`
- Index on `customer_id`

---

### 4. `ledger_entries` ⭐ (Critical)
Append-only financial ledger — single source of truth for all balances.

```json
{
  "_id": "ObjectId",
  "entry_id": "string (LED-XXXXXXXX)",
  "account_id": "string (FK → accounts)",
  "type": "enum: DEBIT | CREDIT",
  "category": "enum: DEPOSIT | WITHDRAWAL | TRANSFER_IN | TRANSFER_OUT | COMMISSION",
  "amount": "number (positive for CREDIT, negative for DEBIT)",
  "transaction_ref": "string (DEP/WDR/TXN-XXXXXXXX)",
  "description": "string",
  "created_at": "datetime (UTC)",
  "created_by": "string (user_id or SYSTEM)"
}
```

**Constraints:**
- **Append-only**: No UPDATE or DELETE operations permitted
- **Unique composite index**: `(transaction_ref, account_id, type)` prevents duplicates
- Balance is NEVER stored; always computed via `$sum` aggregation

**Why Append-Only?**
In real banking, financial records are immutable for regulatory compliance. Corrections are made by adding reversing entries, not by modifying original records.

---

### 5. `audit_logs`
Compliance and security audit trail.

```json
{
  "_id": "ObjectId",
  "log_id": "string (AUD-XXXXXXXX)",
  "user_id": "string (nullable)",
  "user_email": "string (nullable)",
  "role": "string (nullable)",
  "action": "enum: LOGIN_SUCCESS | LOGIN_FAILED | REGISTER | CUSTOMER_CREATED | ACCOUNT_CREATED | DEPOSIT_EXECUTED | WITHDRAWAL_EXECUTED | TRANSFER_EXECUTED | TRANSFER_FAILED | KYC_STATUS_UPDATED",
  "details": "string (human-readable description)",
  "ip_address": "string",
  "user_agent": "string",
  "outcome": "enum: SUCCESS | FAILURE",
  "timestamp": "datetime (UTC)"
}
```

**Indexes:**
- Index on `user_id`
- Index on `action`
- Index on `timestamp`

---

### 6. `credit_cards`
Virtual card management.

```json
{
  "_id": "ObjectId",
  "id": "string (CARD-XXXXXXXX)",
  "customer_id": "string (FK → customers)",
  "account_id": "string (FK → accounts)",
  "card_number": "string (masked: **** **** **** 1234)",
  "cvv": "string (masked)",
  "expiry_date": "string (MM/YY)",
  "card_type": "enum: debit | credit",
  "max_limit": "number",
  "current_debt": "number",
  "available_limit": "number",
  "is_frozen": "boolean",
  "created_at": "datetime (UTC)"
}
```

---

## Schema Validation (MongoDB JSON Schema)

MongoDB server-side validation is configured in `backend/app/core/database.py` to enforce required fields and type constraints at the database level. This provides an additional layer of data integrity beyond Pydantic application-level validation.

## Entity Relationships

```
users 1──────N accounts
  │                │
  │                │
  1                N
  │                │
customers    ledger_entries
  │
  N
  │
credit_cards
```

Every financial operation (deposit, withdrawal, transfer) creates ledger entries. Balances are always derived from the sum of ledger entries.
