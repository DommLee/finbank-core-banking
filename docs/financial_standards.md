# Financial System Standards — FinBank Mapping

## ISO 20022

ISO 20022 is the global standard for financial messaging. FinBank implements:

- **pacs.008.001.08** (FI-to-FI Customer Credit Transfer): Used for inter-bank transfers via WebSocket. Our `iso20022.py` utility generates and parses compliant XML messages with proper debtor/creditor account structures.
- **pacs.002.001.10** (Payment Status Report): Generated to confirm or reject incoming transfers with status codes (ACTC = Accepted, RJCT = Rejected).

### Mapping
| ISO 20022 Element | FinBank Implementation |
|---|---|
| `MsgId` | `FINB-{uuid}` message identifier |
| `CreDtTm` | UTC timestamp |
| `IntrBkSttlmAmt` | Transfer amount with currency code |
| `Dbtr` / `DbtrAcct` | Sender name + IBAN |
| `Cdtr` / `CdtrAcct` | Receiver name + IBAN |
| `CdtrAgt.BICFI` | Receiver bank BIC code |
| `RmtInf.Ustrd` | Transfer description |

**Source Code**: `backend/app/utils/iso20022.py`

---

## SWIFT Messaging

SWIFT (Society for Worldwide Interbank Financial Telecommunication) handles global financial messaging. FinBank maps to SWIFT concepts:

| SWIFT Concept | FinBank Implementation |
|---|---|
| MT103 (Single Customer Transfer) | `POST /api/v1/transactions/transfer` |
| SWIFT gpi Tracker | Webhook events (TransferCreated → TransferCompleted) |
| BIC/SWIFT Code | Bank codes in `core/banks.py` |
| Message acknowledgment | pacs.002 XML response (ACTC/RJCT) |

Our webhook events mirror SWIFT gpi's real-time tracking:
1. `TransferCreated` → Transfer initiated (like gpi initiation)
2. `AccountDebited` → Source account debited
3. `AccountCredited` → Target account credited
4. `TransferCompleted` → Settlement confirmed (like gpi confirmation)

---

## EMV Payment Infrastructure

EMV (Europay, Mastercard, Visa) is the chip-based payment standard. FinBank conceptually maps:

| EMV Concept | FinBank Implementation |
|---|---|
| Card authorization | Transfer validation (amount limits, balance check, ownership) |
| Transaction amount limits | Max 1,000,000 TRY per transaction (Pydantic validation) |
| PIN verification | JWT token verification + account ownership check |
| Card issuance | Virtual card generation with CVV, expiry masking |
| Online/contactless limits | Card settings with configurable limits per transaction type |

**Source Code**: `backend/app/api/v1/cards.py`, `backend/app/api/v1/transactions.py`

---

## Open Banking APIs (PSD2)

PSD2 (Payment Services Directive 2) mandates open access to banking data. FinBank maps:

| PSD2 Concept | FinBank Implementation |
|---|---|
| OAuth2 Token Exchange | JWT Bearer authentication via Supabase Auth |
| TPP (Third-Party Provider) Access | Role-based API access (customer, employee, admin, ceo) |
| AISP (Account Information) | `GET /api/v1/accounts/` — view account data |
| PISP (Payment Initiation) | `POST /api/v1/transactions/transfer` — initiate payments |
| Strong Customer Authentication (SCA) | Login + JWT token + account ownership validation |
| Consent Model | RBAC roles define access scope per endpoint |

**Source Code**: `backend/app/core/security.py`

---

## How FinBank REST API Maps to Real Financial Systems

```
┌──────────────────────────────────────────────────────────────────┐
│                    FinBank REST API Layer                        │
│                                                                  │
│  POST /transfer ──────────→ ISO 20022 pacs.008 (Credit Transfer)│
│  POST /deposit  ──────────→ ISO 20022 camt.054 (Bank-to-Cust.)  │
│  GET  /ledger   ──────────→ ISO 20022 camt.053 (Statement)      │
│  GET  /accounts ──────────→ PSD2 AISP (Account Information)     │
│  JWT Auth       ──────────→ PSD2 OAuth2 + SCA                   │
│  Webhooks       ──────────→ SWIFT gpi Tracker                   │
│  Audit Logs     ──────────→ PCI DSS Requirement 10              │
│  Double-Entry   ──────────→ IAS/IFRS Accounting Standards       │
│  Card Limits    ──────────→ EMV Authorization                   │
└──────────────────────────────────────────────────────────────────┘
```

This mapping demonstrates that while FinBank uses simplified REST/JSON instead of raw XML/SWIFT messages, the underlying concepts, data structures, and transaction flows are architecturally equivalent to production financial systems.
