# 🏦 FinBank — Week 2: Security, Integration & Demo

> **Team 2** | Mini Core Banking System | FastAPI + MongoDB + React  
> Developer: Abdullah Yıldız (DommLee)  
> Architecture: Modular Monolith → Microservice-Ready

---

## Table of Contents

1. [Deliverables Overview](#1-deliverables-overview)
2. [JWT + RBAC Authentication](#2-jwt--rbac-authentication)
3. [Ledger Verification](#3-ledger-verification)
4. [Audit Logs](#4-audit-logs)
5. [UI / Mobile Demo](#5-ui--mobile-demo)
6. [CI Pipeline](#6-ci-pipeline)
7. [Swagger v1.0](#7-swagger-v10)
8. [Presentation Guide](#8-presentation-guide-1215-min)
9. [Final Architecture](#9-final-architecture)
10. [Security Overview](#10-security-overview)
11. [End-to-End Demo](#11-end-to-end-demo)
12. [Lessons Learned](#12-lessons-learned)

---

## 1. Deliverables Overview

| # | Deliverable | Status | Location |
|---|------------|--------|----------|
| 2.1 | All Week 2 deliverables | ✅ Done | This document |
| 2.2 | JWT + RBAC | ✅ Done | `backend/app/core/security.py` |
| 2.3 | Ledger verification | ✅ Done | `backend/app/services/ledger_service.py` |
| 2.4 | Audit logs | ✅ Done | `backend/app/services/audit_service.py` |
| 2.5 | UI demo | ✅ Done | `frontend/src/pages/` (21 pages) |
| 2.6 | CI pipeline | ✅ Done | `.github/workflows/` (3 workflows) |
| 2.7 | Swagger v1.0 | ✅ Done | `/docs` endpoint + `docs/api.yaml` |
| 2.8 | Presentation | ✅ Done | This document (12–15 min script) |
| 2.9 | Final architecture | ✅ Done | `docs/architecture.md` + diagram |
| 2.10 | Security overview | ✅ Done | `docs/security_notes.md` |
| 2.11 | End-to-end demo | ✅ Done | Login → KYC → Transfer → Ledger → Audit |
| 2.12 | Lessons learned | ✅ Done | Section 12 of this document |

---

## 2. JWT + RBAC Authentication

### 2.1 How It Works

FinBank uses **Supabase Auth** for JWT token management with a custom **Role-Based Access Control (RBAC)** layer built on FastAPI dependencies.

```
User Login → Supabase Auth → JWT Token (60 min expiry)
    └→ Token sent as Bearer header in every API request
    └→ Backend validates via supabase.auth.get_user(token)
    └→ Role checked from MongoDB user document
```

### 2.2 Authentication Flow

**File:** `backend/app/core/security.py`

```python
# Token validation: Every protected endpoint uses this dependency
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db=Depends(get_database),
) -> dict:
    """Dependency: get current authenticated user from Supabase JWT."""
    try:
        # 1. Validate JWT with Supabase
        user_response = get_supabase_client().auth.get_user(token)
        if not user_response or not user_response.user:
            raise ValueError("No user returned")
        email = user_response.user.email
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Supabase token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 2. Fetch user from MongoDB (with role information)
    user = await db.users.find_one({"email": email})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    # 3. Check if account is active
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account deactivated")
    
    return user
```

### 2.3 RBAC — 4 Roles

| Role | Access Level | Redirect |
|------|-------------|----------|
| `customer` | Own accounts, transactions, ledger | `/customer/dashboard` |
| `employee` | Customer management, KYC processing | `/employee/portal` |
| `ceo` | Executive dashboards, reports, audit | `/executive/cockpit` |
| `admin` | Full system access, all endpoints | `/admin/dashboard` |

### 2.4 Role Enforcement (Dependency Injection)

```python
# Single role requirement
def require_role(required_role: str):
    async def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user.get("role") != required_role:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Required role: {required_role}",
            )
        return current_user
    return role_checker

# Multi-role requirement
def require_roles(*allowed_roles: str):
    async def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user.get("role") not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Allowed roles: {', '.join(allowed_roles)}",
            )
        return current_user
    return role_checker

# Pre-built role dependencies (used across all routers)
require_admin    = require_role("admin")
require_customer = require_role("customer")
require_employee = require_role("employee")
require_ceo      = require_role("ceo")

# Composite roles
require_staff        = require_roles("employee", "admin")
require_management   = require_roles("ceo", "admin")
require_any_internal = require_roles("employee", "ceo", "admin")
```

### 2.5 Usage in API Endpoints

```python
# Example: Only admin can view audit logs
@router.get("/audit/", dependencies=[Depends(require_admin)])
async def list_audit_logs():
    ...

# Example: Only customer can see their own accounts
@router.get("/accounts/", dependencies=[Depends(require_customer)])
async def list_my_accounts():
    ...

# Example: Employee OR admin can manage customers
@router.get("/customers/", dependencies=[Depends(require_staff)])
async def list_all_customers():
    ...
```

---

## 3. Ledger Verification

### 3.1 Design: Append-Only Ledger

The ledger follows real-world **double-entry bookkeeping** principles:

- ✅ **Append-only** — No UPDATE or DELETE operations ever
- ✅ **Computed balances** — Balance is never stored, always aggregated from entries
- ✅ **ACID transfers** — MongoDB multi-document transactions
- ✅ **Idempotent** — Transaction ref prevents duplicate entries

**File:** `backend/app/services/ledger_service.py`

### 3.2 Balance Computation (Never Stored)

```python
class LedgerService:
    """Manages append-only ledger entries and balance computation."""

    async def get_balance(self, account_id: str) -> float:
        """
        Compute account balance by aggregating ALL ledger entries.
        Balance is NEVER stored — always computed from the ledger.
        """
        pipeline = [
            {"$match": {"account_id": account_id}},
            {"$group": {"_id": None, "balance": {"$sum": "$amount"}}},
        ]
        result = await self.collection.aggregate(pipeline).to_list(1)
        if result:
            balance = result[0]["balance"]
            if isinstance(balance, Decimal128):
                return float(str(balance))
            return float(balance)
        return 0.0
```

> **Why compute instead of store?**  
> Stored balances can drift from reality due to bugs, race conditions, or manual DB edits.  
> Computing from the ledger ensures the balance is always provably correct.

### 3.3 Append Entry (The ONLY Way to Modify Balances)

```python
async def append_entry(
    self,
    account_id: str,
    entry_type: str,      # "CREDIT" or "DEBIT"
    category: str,        # "DEPOSIT", "WITHDRAWAL", "TRANSFER_IN", "TRANSFER_OUT"
    amount: float,
    transaction_ref: str, # Unique reference (e.g., "TXN-A1B2C3D4")
    created_by: str,
    description: str = "",
    session=None,         # MongoDB session for ACID transactions
) -> dict:
    """
    Append a single ledger entry.
    This is the ONLY way to modify balances.
    No UPDATE or DELETE operations are ever performed.
    """
    entry = {
        "entry_id": self._generate_entry_id(),   # "LED-XXXXXXXX"
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
    return entry
```

### 3.4 Atomic Transfer (Double-Entry with MongoDB Transaction)

```python
async def execute_transfer(
    self, from_account_id, to_account_id, amount, created_by, description
) -> str:
    """
    Execute a transfer using MongoDB multi-document transaction.
    Both debit and credit are atomically committed.
    """
    # Pre-check balance
    balance = await self.get_balance(from_account_id)
    if balance + overdraft_limit < amount:
        raise InsufficientFundsError()

    txn_ref = f"TXN-{uuid.uuid4().hex[:8].upper()}"

    # Atomic transaction — both succeed or both fail
    async with await self.db.client.start_session() as session:
        async def _txn_body(s):
            # DEBIT the source account
            await self.append_entry(
                account_id=from_account_id,
                entry_type="DEBIT",
                category="TRANSFER_OUT",
                amount=-amount,
                transaction_ref=txn_ref,
                session=s,
            )
            # CREDIT the target account
            await self.append_entry(
                account_id=to_account_id,
                entry_type="CREDIT",
                category="TRANSFER_IN",
                amount=amount,
                transaction_ref=txn_ref,
                session=s,
            )

        await session.with_transaction(_txn_body)

    return txn_ref
```

### 3.5 Ledger Data Model

```python
class LedgerType(str, Enum):
    DEBIT = "DEBIT"
    CREDIT = "CREDIT"

class LedgerCategory(str, Enum):
    DEPOSIT = "DEPOSIT"
    WITHDRAWAL = "WITHDRAWAL"
    TRANSFER_IN = "TRANSFER_IN"
    TRANSFER_OUT = "TRANSFER_OUT"

class LedgerEntryResponse(BaseModel):
    id: str
    entry_id: str           # "LED-XXXXXXXX"
    account_id: str
    type: str               # DEBIT or CREDIT
    category: str           # DEPOSIT, WITHDRAWAL, TRANSFER_IN, TRANSFER_OUT
    amount: float
    transaction_ref: str    # Unique transaction reference
    description: str | None
    created_at: datetime
    created_by: str
```

---

## 4. Audit Logs

### 4.1 Design: Immutable Compliance Trail

Every security-relevant action is logged to the `audit_logs` MongoDB collection.

**File:** `backend/app/services/audit_service.py`

```python
async def log_audit(
    action: str,
    outcome: str,
    user_id: str = None,
    user_email: str = None,
    role: str = None,
    details: str = None,
    ip_address: str = None,
    user_agent: str = None,
):
    """
    Insert an audit log entry into MongoDB.
    Called after every mutation or security-relevant action.
    """
    audit_entry = {
        "log_id": f"AUD-{uuid.uuid4().hex[:8].upper()}",
        "user_id": user_id,
        "user_email": user_email,
        "role": role,
        "action": action,
        "details": details,
        "ip_address": ip_address,
        "user_agent": user_agent,
        "outcome": outcome,
        "timestamp": datetime.now(timezone.utc),
    }
    await db.audit_logs.insert_one(audit_entry)
```

### 4.2 Tracked Actions

| Action | When Logged | Outcome |
|--------|------------|---------|
| `LOGIN_SUCCESS` | User successfully logs in | SUCCESS |
| `LOGIN_FAILED` | Invalid credentials | FAILURE |
| `REGISTER` | New user registration | SUCCESS |
| `CUSTOMER_CREATED` | KYC profile submitted | SUCCESS |
| `CUSTOMER_UPDATED` | Profile information changed | SUCCESS |
| `ACCOUNT_CREATED` | New bank account opened | SUCCESS |
| `DEPOSIT_EXECUTED` | Money deposited | SUCCESS |
| `WITHDRAWAL_EXECUTED` | Money withdrawn | SUCCESS |
| `TRANSFER_EXECUTED` | Transfer completed | SUCCESS |
| `TRANSFER_FAILED` | Insufficient funds, etc. | FAILURE |
| `KYC_STATUS_UPDATED` | Admin approves/rejects KYC | SUCCESS |

### 4.3 Audit Entry Schema

| Field | Type | Example |
|-------|------|---------|
| `log_id` | string | `AUD-A1B2C3D4` |
| `user_id` | string | `abc-123-def` |
| `user_email` | string | `user@finbank.com` |
| `role` | string | `customer` |
| `action` | string | `TRANSFER_EXECUTED` |
| `outcome` | string | `SUCCESS` / `FAILURE` |
| `timestamp` | datetime | `2026-03-10T09:00:00Z` |
| `ip_address` | string | `192.168.1.10` |
| `user_agent` | string | `Mozilla/5.0...` |
| `details` | string | `Transfer 5000 TRY from ACC-001 to ACC-002` |

### 4.4 Client Info Extraction

```python
def get_client_info(request: Request) -> tuple[str, str]:
    """Extract IP address and user agent from request."""
    ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "unknown")
    return ip, ua
```

---

## 5. UI / Mobile Demo

### 5.1 Frontend Technology Stack

| Tech | Version | Purpose |
|------|---------|---------|
| React | 18.3.1 | UI Framework |
| Vite | 5.4.0 | Build Tool |
| Tailwind CSS | 4.2.1 | Styling |
| React Router | 6.26.0 | Navigation |
| Recharts | 3.7.0 | Charts & Analytics |
| Framer Motion | 12.35.2 | Animations |
| React Three Fiber | 8.x | 3D Elements |
| Supabase JS | 2.98.0 | Auth Client |
| Axios | 1.7.0 | HTTP Client |

### 5.2 Pages (21 Total)

| Page | File | Description |
|------|------|-------------|
| **Login** | `LoginPage.jsx` | Auth with role-based redirect |
| **Dashboard** | `DashboardPage.jsx` | Account overview + charts |
| **Accounts** | `AccountsPage.jsx` | Account management |
| **Transfer** | `TransferPage.jsx` | Money transfers |
| **Transfer History** | `TransferHistoryPage.jsx` | Transaction history |
| **Ledger** | `LedgerPage.jsx` | Ledger entries viewer |
| **Audit** | `AuditPage.jsx` | Audit log viewer (Admin) |
| **KYC** | `KYCPage.jsx` | Customer verification |
| **Admin Panel** | `AdminPanelPage.jsx` | Full admin controls |
| **Employee Panel** | `EmployeePanelPage.jsx` | Employee workspace |
| **Bill Pay** | `BillPayPage.jsx` | Bill payments |
| **Card Controls** | `CardControlsPage.jsx` | Credit card management |
| **Exchange Rates** | `ExchangeRatesPage.jsx` | Currency exchange |
| **Messages** | `MessagesPage.jsx` | Internal messaging |
| **Profile** | `ProfilePage.jsx` | User profile |
| **Security Settings** | `SecuritySettingsPage.jsx` | Password & 2FA |
| **Savings Goals** | `SavingsGoalsPage.jsx` | Financial goals |
| **Spending Analysis** | `SpendingAnalysisPage.jsx` | Analytics |
| **Notifications** | `NotificationsPage.jsx` | Alert center |
| **Contact** | `ContactPage.jsx` | Support page |
| **404 Page** | `NotFoundPage.jsx` | Error handling |

### 5.3 Role-Based Dashboards

```
customer  → /customer/dashboard  (accounts, transfers, ledger)
employee  → /employee/portal     (KYC processing, customer mgmt)
ceo       → /executive/cockpit   (reports, analytics, audit)
admin     → /admin/dashboard     (full system access)
```

---

## 6. CI Pipeline

### 6.1 Overview

FinBank has **3 GitHub Actions workflows**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | push/PR to main, dev | Backend + Frontend + Docker verification |
| `deploy-pages.yml` | push to main | Deploy frontend to GitHub Pages |
| `secret-scan.yml` | push/PR to main, dev | Gitleaks secret scanning |

### 6.2 Main CI Pipeline (`ci.yml`)

```yaml
name: FinBank CI/CD Pipeline

on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main]

jobs:
  # Job 1: Backend Lint & Test
  backend:
    name: Backend - Lint & Test
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - name: Set up Python 3.11
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"
          cache: "pip"
      - name: Install dependencies
        run: pip install -r requirements.txt
      - name: Lint with ruff
        run: ruff check . --output-format=github
      - name: Run unit tests
        env:
          MONGODB_URL: mongodb://localhost:27017
          JWT_SECRET: test-secret-key-for-ci
        run: python -m pytest tests/ -v --tb=short

  # Job 2: Frontend Lint & Build
  frontend:
    name: Frontend - Lint & Build
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - name: Set up Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: "20"
      - name: Install dependencies
        run: npm ci --legacy-peer-deps || npm install --legacy-peer-deps
      - name: Build
        run: npm run build

  # Job 3: Docker Build Verification
  docker:
    name: Docker - Build Verification
    runs-on: ubuntu-latest
    needs: [backend, frontend]  # Runs AFTER both pass
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t finbank-backend ./backend
      - run: docker build -t finbank-frontend ./frontend
      - run: docker compose config
```

### 6.3 GitHub Pages Deployment (`deploy-pages.yml`)

```yaml
name: Deploy Frontend to GitHub Pages
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm install --legacy-peer-deps
        working-directory: frontend
      - run: npm run build
        working-directory: frontend
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./frontend/dist

  deploy:
    needs: build
    environment:
      name: github-pages
    steps:
      - uses: actions/deploy-pages@v4
```

### 6.4 Secret Scanning (`secret-scan.yml`)

```yaml
name: Secret Scan
on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main]

jobs:
  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 7. Swagger v1.0

### 7.1 Auto-Generated API Docs

FastAPI provides automatic Swagger UI documentation:

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`
- **OpenAPI Spec**: `docs/api.yaml` (version 3.0.3)

### 7.2 API Endpoints Summary

| Group | Endpoint | Method | Auth |
|-------|---------|--------|------|
| **Auth** | `/api/v1/auth/register` | POST | ❌ Public |
| | `/api/v1/auth/login` | POST | ❌ Public |
| | `/api/v1/auth/me` | GET | ✅ Bearer |
| **Customers** | `/api/v1/customers/` | POST | ✅ Customer |
| | `/api/v1/customers/` | GET | ✅ Admin |
| | `/api/v1/customers/me` | GET | ✅ Customer |
| | `/api/v1/customers/{id}/status` | PATCH | ✅ Admin |
| **Accounts** | `/api/v1/accounts/` | POST/GET | ✅ Customer |
| | `/api/v1/accounts/{id}/balance` | GET | ✅ Customer |
| **Transactions** | `/api/v1/transactions/deposit` | POST | ✅ Customer |
| | `/api/v1/transactions/withdraw` | POST | ✅ Customer |
| | `/api/v1/transactions/transfer` | POST | ✅ Customer |
| **Ledger** | `/api/v1/ledger/` | GET | ✅ Customer |
| **Audit** | `/api/v1/audit/` | GET | ✅ Admin |
| **Cards** | `/api/v1/cards/` | POST/GET | ✅ Customer |
| **Exchange** | `/api/v1/exchange/rates` | GET | ✅ Any |
| **Bills** | `/api/v1/bills/` | POST/GET | ✅ Customer |
| **Messages** | `/api/v1/messages/` | POST/GET | ✅ Any Auth |
| **System** | `/health` | GET | ❌ Public |

### 7.3 Request/Response Examples

**Login Request:**
```json
POST /api/v1/auth/login
Content-Type: application/x-www-form-urlencoded

email=user@finbank.com&password=SecurePass123
```

**Login Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "role": "customer"
}
```

**Transfer Request:**
```json
POST /api/v1/transactions/transfer
Authorization: Bearer eyJhbGci...

{
  "from_account_id": "ACC-001",
  "to_account_id": "ACC-002",
  "amount": 5000.00,
  "description": "Rent payment"
}
```

---

## 8. Presentation Guide (12–15 min)

### Slide Script

| Time | Topic | What to Show |
|------|-------|-------------|
| 0:00–1:30 | **Introduction** | Project name, team, tech stack overview |
| 1:30–3:30 | **Architecture** | Modular monolith diagram, module responsibilities table |
| 3:30–5:30 | **JWT + RBAC** | `security.py` code, 4 roles table, dependency injection pattern |
| 5:30–7:30 | **Ledger System** | Append-only design, computed balances, atomic transfers code |
| 7:30–9:00 | **Audit Logs** | `audit_service.py`, tracked actions table, compliance |
| 9:00–10:00 | **CI Pipeline** | 3 workflows, GitHub Actions screenshots |
| 10:00–11:00 | **Swagger API** | Live `/docs` demo, endpoint summary |
| 11:00–13:00 | **Live Demo** | Login → KYC → Deposit → Transfer → Ledger → Audit |
| 13:00–14:00 | **Security** | Rate limiting, CORS, input validation, secret scanning |
| 14:00–15:00 | **Lessons Learned** | Challenges, decisions, future improvements |

---

## 9. Final Architecture

### 9.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React 18 + Vite)           │
│  ┌──────┐ ┌──────────┐ ┌────────┐ ┌──────┐ ┌────────┐  │
│  │Login │ │Dashboard │ │Accounts│ │Trans.│ │Ledger  │  │
│  └──────┘ └──────────┘ └────────┘ └──────┘ └────────┘  │
│                    ↕ Axios + JWT                        │
└────────────────────────────────────────────────────────-┘
                         │ HTTP/REST
                         ▼
┌─────────────────────────────────────────────────────────┐
│              BACKEND (FastAPI — Python 3.11)            │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Middleware Layer                    │    │
│  │  CORS │ Rate Limiter │ Request Logger │ JWT     │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Auth     │ │ Customers │ │ Accounts │ │ Transact │  │
│  │ Module   │ │ Module    │ │ Module   │ │  Module  │  │
│  └──────────┘ └───────────┘ └──────────┘ └──────────┘  │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Ledger   │ │  Audit    │ │ Cards    │ │ Exchange │  │
│  │ Module   │ │  Module   │ │ Module   │ │  Module  │  │
│  └──────────┘ └───────────┘ └──────────┘ └──────────┘  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Core Layer                         │    │
│  │  Config │ Database │ Security │ Exceptions      │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
        │                                    │
        ▼                                    ▼
┌───────────────┐                 ┌───────────────────┐
│   MongoDB 7   │                 │   Supabase Auth   │
│  (Replica Set)│                 │   + Sync Layer    │
│               │                 └───────────────────┘
│ Collections:  │
│ ├─ users      │
│ ├─ customers  │
│ ├─ accounts   │
│ ├─ ledger_    │
│ │  entries    │
│ ├─ audit_logs │
│ ├─ credit_    │
│ │  cards      │
│ └─ messages   │
└───────────────┘
```

### 9.2 Module Responsibilities

| Module | Responsibility | Key Files |
|--------|---------------|-----------|
| **Auth** | Registration, login, JWT, RBAC | `auth.py`, `security.py` |
| **Customers** | KYC creation, profile mgmt, admin approval | `customers.py` |
| **Accounts** | Account opening, IBAN generation, balance | `accounts.py` |
| **Transactions** | Deposit, withdrawal, transfer orchestration | `transactions.py` |
| **Ledger** | Append-only entries, balance computation | `ledger_service.py` |
| **Audit** | Immutable action logs for compliance | `audit_service.py` |
| **Cards** | Credit card issuance, limits, controls | `cards.py` |
| **Exchange** | Currency exchange rates | `exchange.py` |
| **Bills** | Utility bill payments | `bills.py` |
| **Analytics** | Spending analysis, insights | `analytics.py` |

### 9.3 Data Flow: Transfer Operation

```
1. POST /api/v1/transactions/transfer
2. ➜ Auth middleware validates JWT token
3. ➜ Transaction module validates account ownership
4. ➜ Ledger service starts MongoDB session
5. ➜ Within atomic transaction:
   a. Create DEBIT entry for source account  (-5000 TRY)
   b. Create CREDIT entry for target account (+5000 TRY)
6. ➜ Commit transaction (or abort on error)
7. ➜ Supabase sync (fire-and-forget)
8. ➜ Audit: TRANSFER_EXECUTED logged with IP + user agent
```

### 9.4 Microservice-Ready Architecture

The `services/` directory contains Docker-ready microservice stubs:

```
services/
├── auth-service/         # Authentication microservice
├── banking-service/      # Core banking operations
├── admin-service/        # Administration
├── analytics-service/    # Reporting
├── chatbot-service/      # AI chatbot
├── employee-service/     # HR integration
├── notification-service/ # Push/email notifications
├── api-gateway/          # API routing
└── shared/               # Common utilities
```

---

## 10. Security Overview

### 10.1 Authentication Security

| Feature | Implementation |
|---------|---------------|
| **Token Provider** | Supabase Auth (battle-tested, SOC2 compliant) |
| **Token Format** | JWT (JSON Web Token) |
| **Token Expiry** | 60 minutes |
| **Password Hashing** | bcrypt with automatic salt (managed by Supabase) |
| **Token Validation** | Server-side via `supabase.auth.get_user(token)` |

### 10.2 API Security Layers

```python
# 1. Rate Limiting (slowapi)
limiter = Limiter(key_func=get_remote_address)
# Auth endpoints: 5 req/min (brute-force protection)
# General endpoints: 60 req/min

# 2. CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,  # Whitelist only
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Request Logging (every request is timed and logged)
@app.middleware("http")
async def log_requests(request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    logger.info("HTTP Request",
        method=request.method,
        path=request.url.path,
        status=response.status_code,
        duration_ms=round(duration * 1000, 2),
    )
    return response
```

### 10.3 Input Validation (Pydantic)

| Field | Validation Rule |
|-------|----------------|
| Email | `EmailStr` format |
| Password | min 8, max 128 characters |
| National ID | Exactly 11 digits (TC Kimlik) |
| Transfer Amount | > 0, ≤ 1,000,000 TRY |
| Currency | 3-letter uppercase ISO 4217 |
| Account Type | enum: `checking`, `savings`, `business` |

### 10.4 Secure Error Responses

```python
# Custom domain exceptions — no stack traces exposed
class InsufficientFundsError(HTTPException):  # 400
class AccountNotFoundError(HTTPException):     # 404
class AccountFrozenError(HTTPException):       # 403
class SameAccountTransferError(HTTPException): # 400
class DuplicateTransactionError(HTTPException):# 409
```

### 10.5 Secret Management

- `.env.example` with all keys (no values) — committed to repo
- `.env` with actual secrets — in `.gitignore`, never committed
- **Gitleaks** CI workflow scans every push for leaked secrets
- All sensitive config via environment variables

### 10.6 Ledger Integrity (Financial)

| Protection | How |
|-----------|-----|
| Append-only entries | No UPDATE/DELETE on `ledger_entries` |
| Double-entry bookkeeping | Every transfer = DEBIT + CREDIT pair |
| ACID atomicity | MongoDB multi-document transactions |
| Computed balances | No stored balance, no drift possible |
| Idempotency | Unique `transaction_ref` prevents duplicates |

---

## 11. End-to-End Demo

### Demo Flow (for live presentation)

```
Step 1: REGISTER
  POST /api/v1/auth/register
  → Create customer account

Step 2: LOGIN
  POST /api/v1/auth/login
  → Get JWT token
  → Audit: LOGIN_SUCCESS logged

Step 3: KYC
  POST /api/v1/customers/
  → Submit identity verification
  → Admin approves via PATCH /customers/{id}/status
  → Audit: CUSTOMER_CREATED + KYC_STATUS_UPDATED

Step 4: OPEN ACCOUNT
  POST /api/v1/accounts/
  → Create checking account with IBAN
  → Audit: ACCOUNT_CREATED

Step 5: DEPOSIT
  POST /api/v1/transactions/deposit
  → Deposit 10,000 TRY
  → Ledger: CREDIT entry created
  → Audit: DEPOSIT_EXECUTED

Step 6: TRANSFER
  POST /api/v1/transactions/transfer
  → Transfer 5,000 TRY to another account
  → Ledger: DEBIT + CREDIT (atomic pair)
  → Audit: TRANSFER_EXECUTED

Step 7: VERIFY LEDGER
  GET /api/v1/ledger/?account_id=ACC-001
  → Show all entries, computed balance = 5,000 TRY

Step 8: CHECK AUDIT
  GET /api/v1/audit/ (Admin only)
  → Show complete operation history with IPs + timestamps
```

---

## 12. Lessons Learned

### 12.1 Technical Decisions

| Decision | Why | Outcome |
|----------|-----|---------|
| **Modular Monolith** over Microservices | Simpler for team of 1, easy data consistency | ✅ Faster development, no distributed complexity |
| **Supabase Auth** over custom JWT | Battle-tested, SOC2 compliant, free tier | ✅ Secure auth in hours, not weeks |
| **Append-only Ledger** | Real-world banking pattern, eliminates balance drift | ✅ Provably correct balances |
| **MongoDB** over PostgreSQL | Flexible schema for rapid iteration | ✅ Easy to extend, JSON-native |
| **FastAPI** over Django/Flask | Auto Swagger, async by default, type-safe | ✅ Better developer experience |

### 12.2 Challenges Faced

| Challenge | Solution |
|-----------|----------|
| ACID transactions in MongoDB | Used replica set + `with_transaction()` |
| Race conditions in transfers | MongoDB sessions + balance pre-check |
| Peer dependency conflicts | Pinned `@react-three` to React 18 compatible versions |
| Secret leaks risk | Added Gitleaks CI workflow + `.gitignore` discipline |
| CORS issues | Explicit origin whitelist instead of `*` |

### 12.3 What We'd Do Differently

1. **Start with PostgreSQL** — Better for financial data (strict schema, native ACID)
2. **Add WebSocket** — Real-time balance updates instead of polling
3. **Implement 2FA** — TOTP-based two-factor for high-value transactions
4. **Add Redis caching** — Cache exchange rates and session data
5. **Write more tests** — Especially integration tests for the transfer flow

### 12.4 Key Metrics

| Metric | Value |
|--------|-------|
| Total API Endpoints | 35+ |
| Frontend Pages | 21 |
| Backend Modules | 10 |
| CI Workflows | 3 |
| Microservice Stubs | 8 |
| Lines of Code (Backend) | ~5,000+ |
| Lines of Code (Frontend) | ~15,000+ |

---

## Quick Start

```bash
# Clone
git clone https://github.com/your-repo/finbank.git
cd finbank

# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
# → http://localhost:8000/docs (Swagger UI)

# Frontend
cd frontend
npm install
npm run dev
# → http://localhost:5173

# Docker (full stack)
docker compose up -d
```

---

> **FinBank** — Mini Core Banking System  
> Built with ❤️ by Team 2  
> FastAPI + MongoDB + React + Supabase
