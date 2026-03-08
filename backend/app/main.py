"""
=========================================================
FinBank & FinHR - Next Generation Core Banking SaaS
Copyright (C) 2026 Abdullah Yildiz. All Rights Reserved.

Developer: Abdullah Yildiz (abdullahyldxz)
Architecture: Modular Monolith
=========================================================
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import structlog
import time

from app.core.config import settings
from app.core.database import connect_to_mongo, close_mongo_connection
from app.core.logging import configure_logging
from app.api.v1 import accounts, transactions, auth, employee, admin, customers, bills, cards, \
    exchange, ledger, audit, approvals, messages, easy_addresses, payment_requests, auto_bills

# ── Configure Logging ──
configure_logging()
logger = structlog.get_logger()

# ── Rate Limiter ──
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    logger.info("Starting FinBank Core Banking System...")
    await connect_to_mongo()
    logger.info("FinBank is ready to serve requests")
    yield
    logger.info("Shutting down FinBank...")
    await close_mongo_connection()


# ── FastAPI App ──
app = FastAPI(
    title="FinBank - Mini Core Banking System",
    description="""
## Mini Core Banking System

A modern banking API built with **FastAPI + MongoDB + Webhooks**.

### Modules
- 🔐 **Authentication** — JWT-based auth with RBAC (Admin/Customer)
- 👤 **Customer & KYC** — Customer profiles with mock KYC verification
- 🏦 **Account Management** — Account opening, balance inquiry, IBAN generation
- 📒 **Ledger** — Append-only financial ledger (single source of truth)
- 💸 **Transactions** — Deposits, withdrawals, internal transfers
- 📋 **Audit Logs** — Full compliance audit trail

### Financial Data Transfer Mapping
This REST-based system conceptually maps to real financial standards:
- **REST/JSON** → Simplified version of **ISO 20022** XML messages
- **JWT Auth** → Analogous to mTLS + API keys in **Open Banking (PSD2)**
- **Webhooks** → Simplified event notification similar to **SWIFT gpi** tracking
- **Ledger entries** → Follow **double-entry bookkeeping** principles used in core banking

### Technology Stack
- **Backend**: Python 3.11 + FastAPI
- **Database**: MongoDB 7 (with replica set for ACID transactions)
- **Events**: Webhooks (HTTP POST with retry)
- **Security**: JWT + bcrypt + rate limiting + CORS
- **DevOps**: Docker Compose
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── Middleware ──
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log every request with timing."""
    start_time = time.time()
    response: Response = await call_next(request)
    duration = time.time() - start_time
    logger.info(
        "HTTP Request",
        method=request.method,
        path=request.url.path,
        status=response.status_code,
        duration_ms=round(duration * 1000, 2),
    )
    return response


# ── Health Check ──
@app.get("/health", tags=["System"])
async def health_check():
    """Health check endpoint for Docker."""
    return {"status": "healthy", "service": "FinBank Core Banking"}


# ── Register Routers ──
API_PREFIX = "/api/v1"
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(customers.router, prefix=API_PREFIX)
app.include_router(accounts.router, prefix=API_PREFIX)
app.include_router(transactions.router, prefix=API_PREFIX)
app.include_router(ledger.router, prefix=API_PREFIX)
app.include_router(audit.router, prefix=API_PREFIX)
app.include_router(messages.router, prefix=API_PREFIX)
app.include_router(bills.router, prefix=API_PREFIX)
app.include_router(admin.router, prefix=API_PREFIX)
app.include_router(employee.router, prefix=API_PREFIX)
app.include_router(approvals.router, prefix=API_PREFIX)
app.include_router(easy_addresses.router, prefix=API_PREFIX + "/easy-address", tags=["easy-address"])
app.include_router(cards.router, prefix=API_PREFIX + "/cards", tags=["cards"])
app.include_router(exchange.router, prefix=API_PREFIX + "/exchange", tags=["exchange"])
app.include_router(payment_requests.router, prefix="/api/v1/payment-requests", tags=["Payment Requests"])
app.include_router(auto_bills.router, prefix="/api/v1/auto-bills", tags=["Auto Bills"])


# ── Root ──
@app.get("/", tags=["System"])
async def root():
    """Root endpoint."""
    return {
        "name": "FinBank - Mini Core Banking System",
        "version": "1.0.0",
        "team": "Team 2: Python + MongoDB + Webhooks",
        "architecture": "Modular Monolith",
        "docs": "/docs",
        "redoc": "/redoc",
    }
