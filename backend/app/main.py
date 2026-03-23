"""
=========================================================
FinBank & FinHR - Next Generation Core Banking SaaS
Copyright (C) 2026 Abdullah Yildiz. All Rights Reserved.

Developer: DommLee
Architecture: Modular Monolith
=========================================================
"""
import asyncio
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import structlog
import time
import uuid

from app.core.config import settings
from app.core.database import connect_to_mongo, close_mongo_connection, get_database
from app.core.logging import configure_logging
from app.api.v1 import accounts, transactions, auth, employee, admin, customers, bills, cards, \
    exchange, ledger, audit, approvals, messages, easy_addresses, payment_requests, auto_bills, goals, analytics, \
    market, notifications

from app.core.banks import fetch_external_banks
from app.utils.iso20022 import parse_pacs008_xml, generate_pacs002_xml
from app.core.security import authenticate_token
from app.core.ws_manager import ws_manager
from app.services.ledger_service import LedgerService

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
    await fetch_external_banks()
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
@limiter.limit("60/minute")
async def health_check(request: Request):
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
app.include_router(goals.router, prefix=API_PREFIX)
app.include_router(analytics.router, prefix=API_PREFIX)
app.include_router(market.router, prefix=API_PREFIX)
app.include_router(notifications.router, prefix=API_PREFIX)


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


# ── Customer WebSocket Endpoint (real-time notifications) ──
async def _resolve_ws_user(websocket: WebSocket, db, token: str | None = None) -> dict | None:
    ws_token = token or websocket.query_params.get("token")

    if not ws_token:
        auth_header = websocket.headers.get("authorization", "")
        if auth_header.lower().startswith("bearer "):
            ws_token = auth_header[7:].strip()

    # Browser clients can authenticate with the first frame:
    # {"type":"auth","token":"..."} or plain token text.
    if not ws_token:
        try:
            first_message = await asyncio.wait_for(websocket.receive_text(), timeout=8)
            try:
                parsed = json.loads(first_message)
                if isinstance(parsed, dict) and parsed.get("type") == "auth":
                    ws_token = str(parsed.get("token", "")).strip()
            except json.JSONDecodeError:
                ws_token = first_message.strip()
        except Exception:
            ws_token = None

    if not ws_token:
        await websocket.close(code=1008)
        return None

    try:
        return await authenticate_token(ws_token, db)
    except Exception:
        await websocket.close(code=1008)
        return None


async def _handle_customer_websocket(websocket: WebSocket, db, token: str | None = None):
    await websocket.accept()
    current_user = await _resolve_ws_user(websocket, db, token)
    if not current_user:
        return

    user_id = current_user["user_id"]
    await ws_manager.connect(websocket, user_id)
    logger.info("customer_ws_connected", user_id=user_id, online_connections=ws_manager.online_count())

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                msg_type = msg.get("type")
                if msg_type == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
                elif msg_type == "auth":
                    await websocket.send_text(json.dumps({"type": "auth_ok"}))
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        logger.info("customer_ws_disconnected", user_id=user_id)
    except Exception as e:
        logger.warning("customer_ws_error", user_id=user_id, error=str(e))
    finally:
        ws_manager.disconnect(websocket, user_id)


@app.websocket("/api/v1/ws")
async def customer_websocket_query_token(websocket: WebSocket, db=Depends(get_database)):
    """Primary customer WebSocket endpoint: /api/v1/ws?token=..."""
    await _handle_customer_websocket(websocket, db)


@app.websocket("/api/v1/ws/{token}")
async def customer_websocket_path_token(websocket: WebSocket, token: str, db=Depends(get_database)):
    """Backward-compatible customer WebSocket endpoint with token in path."""
    await _handle_customer_websocket(websocket, db, token=token)


# ── Inter-Bank WebSocket Endpoint ──
@app.websocket("/ws/inter-bank/{sender_bank_code}")
async def inter_bank_websocket(websocket: WebSocket, sender_bank_code: str, db=Depends(get_database)):
    """Accept incoming ISO 20022 Pacs.008 transfers."""
    await websocket.accept()
    try:
        xml_data = await websocket.receive_text()
        transfer_details = parse_pacs008_xml(xml_data)
        
        receiver_iban = transfer_details.get("receiver_iban")
        amount = transfer_details.get("amount")
        msg_id = transfer_details.get("end_to_end_id") or transfer_details.get("msg_id") or "UNKNOWN"
        
        if not receiver_iban or not amount:
            reject_xml = generate_pacs002_xml(msg_id, "RJCT", "Missing receiver_iban or amount in pacs.008")
            await websocket.send_text(reject_xml)
            return

        target_account = await db.accounts.find_one({"iban": receiver_iban, "status": "active"})
        if not target_account:
            reject_xml = generate_pacs002_xml(msg_id, "RJCT", "Account not found or inactive")
            await websocket.send_text(reject_xml)
            return

        description = transfer_details.get("description", "Dis Banka Transferi")
        
        # Credit the user
        ledger = LedgerService(db)
        
        try:
            await ledger.deposit(
                account_id=target_account["account_id"],
                amount=amount,
                created_by="EXTERNAL_BANK",
                description=f"{description} (From: {transfer_details.get('sender_iban')})"
            )
            
            accept_xml = generate_pacs002_xml(msg_id, "ACCP")
            await websocket.send_text(accept_xml)
            
        except Exception as e:
            logger.error("Interbank WS Ledger Deposit Error", error=str(e))
            reject_xml = generate_pacs002_xml(msg_id, "RJCT", "Internal Error processing deposit")
            await websocket.send_text(reject_xml)

    except WebSocketDisconnect:
        logger.info(f"[Inter-Bank WS] {sender_bank_code} client disconnected.")
    except Exception as e:
        logger.error(f"[Inter-Bank WS] Error: {e}")
        try:
            error_xml = generate_pacs002_xml("UNKNOWN", "RJCT", f"Internal Error: {str(e)}")
            await websocket.send_text(error_xml)
        except:
            pass
    finally:
        try:
            await websocket.close()
        except RuntimeError:
            pass
