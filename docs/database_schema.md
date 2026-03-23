# Database Schema

This document describes the MongoDB schema used by the FinBank modular monolith.

## Engine and Consistency

- Database: MongoDB 7
- Driver: Motor async client (`backend/app/core/database.py`)
- Replica set: `rs0` in Docker for multi-document transactions
- Core consistency rule: balances are derived from `ledger_entries`, not persisted as mutable account balances

## Core Collections

### `users`
Purpose: identity and authorization profile mapped to Supabase user.

Key fields:
- `user_id` (UUID from Supabase)
- `email` (unique index)
- `role` (`customer`, `employee`, `ceo`, `admin`)
- `is_active`
- `kyc_status`
- `created_at`

Indexes:
- `email` unique

### `customers`
Purpose: KYC profile and personal identity data.

Key fields:
- `customer_id`
- `user_id`
- `full_name`
- `national_id`
- `phone`
- `status` (`pending`, `active`, `suspended`)
- `kyc_verified`
- `created_at`, `updated_at`

Indexes:
- `national_id` unique
- `user_id`

### `accounts`
Purpose: bank account metadata (ownership + IBAN + status).

Key fields:
- `account_id`
- `account_number` (unique index)
- `iban`
- `customer_id`
- `user_id`
- `account_type` (`checking`, `savings`, `credit`)
- `currency`
- `status` (`active`, `frozen`, `closed`)
- `created_at`

Indexes:
- `account_number` unique
- `customer_id`

### `ledger_entries` (critical)
Purpose: append-only financial source of truth.

Key fields:
- `entry_id`
- `account_id`
- `type` (`DEBIT`, `CREDIT`)
- `category` (`DEPOSIT`, `WITHDRAWAL`, `TRANSFER_IN`, `TRANSFER_OUT`, `COMMISSION`)
- `amount`
- `transaction_ref`
- `description`
- `created_by`
- `created_at`

Indexes:
- Composite unique: `(transaction_ref, account_id, type, category)`
- `account_id`
- `created_at`

Validation:
- JSON schema validator enforced in `connect_to_mongo()`
- Required fields include timestamp and actor metadata

### `audit_logs`
Purpose: compliance and forensic trail.

Key fields:
- `action`
- `outcome`
- `user_id`
- `user_email`
- `role`
- `details`
- `ip_address`
- `user_agent`
- `timestamp`

Indexes:
- `timestamp`
- `user_id`
- `action`

### `notifications`
Purpose: in-app notifications consumed by UI + WebSocket realtime push.

Key fields:
- `notification_id`
- `user_id`
- `type`
- `message`
- `metadata`
- `read`
- `read_at`
- `created_at`

Indexes:
- `notification_id` unique
- `user_id`
- `read`
- `created_at`

## Supporting Collections

The application also uses domain-specific collections:
- `approvals`
- `bills`
- `auto_bills`
- `payment_requests`
- `easy_addresses`
- `messages`
- `credit_cards`
- `credit_card_transactions`
- `debit_cards`
- `goals`
- `transactions`
- `idempotency_keys`
- `verification_codes`
- `commission_ledger`
- `investment_portfolio`
- `system_configs`

## Financial Correctness Rules

1. No balance mutation API exists outside ledger operations.
2. Every monetary operation inserts one or more ledger entries.
3. Transfers are executed atomically with MongoDB transactions.
4. Balance is computed via aggregation (`SUM(amount)`) on `ledger_entries`.
5. Idempotency keys prevent duplicate processing for retrying clients.
