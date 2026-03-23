# Financial Standards Mapping

This document explains how FinBank APIs conceptually map to common financial standards expected in core banking education.

## 1. ISO 20022

Reference implementation:
- `backend/app/utils/iso20022.py`
- `backend/app/main.py` inter-bank WebSocket endpoint
- `backend/app/api/v1/transactions.py` inter-bank transfer path

Implemented message families:
- `pacs.008.001.08` generation (`generate_pacs008_xml`)
- `pacs.002.001.10` generation (`generate_pacs002_xml`)
- Parser support for both messages

How it maps:
- Internal transfer API payloads (JSON) keep debtor/creditor/amount semantics.
- Inter-bank path transforms internal request to ISO XML before sending to other bank systems.

## 2. SWIFT-style Tracking (conceptual)

Reference implementation:
- `backend/app/events/webhook.py`

Event lifecycle used in transfer processing:
- `TransferCreated`
- `AccountDebited`
- `AccountCredited`
- `TransferCompleted`

Conceptual mapping:
- These events behave like status-tracking notifications in correspondent banking flows (similar to SWIFT tracker updates), but transport is webhook HTTP rather than SWIFT network protocols.

## 3. EMV / Card Domain (conceptual)

Reference implementation:
- `backend/app/api/v1/cards.py`
- `backend/app/models/credit_card.py`

Conceptual mapping:
- Card operations include spend controls, freeze/unfreeze, and debt payment workflows that mirror card authorization and post-settlement behavior.
- This project does not implement EMV kernel/chip protocol; it uses API-level abstractions suitable for coursework.

## 4. Open Banking API Concepts

Reference implementation:
- `backend/app/core/security.py`
- `backend/app/api/v1/auth.py`
- `backend/app/main.py` CORS + rate limiting middleware

Conceptual mapping:
- JWT bearer token + RBAC approximates consented access scope.
- Customer, staff, and admin roles emulate permissioned API surfaces expected in open banking ecosystems.

## 5. REST Endpoint Mapping Table

| Domain concept | FinBank endpoint(s) | Standard analogy |
|---|---|---|
| Customer onboarding | `POST /api/v1/auth/register` | KYC onboarding lifecycle |
| Account opening | `POST /api/v1/accounts/` | Account origination |
| Intra-bank transfer | `POST /api/v1/transactions/transfer` | Credit transfer initiation |
| Inter-bank transfer | `POST /api/v1/transactions/transfer` + WS inter-bank | ISO 20022 pacs.008/pacs.002 exchange |
| Ledger query | `GET /api/v1/ledger/` | Statement/event ledger read |
| Audit review | `GET /api/v1/audit/` | Compliance and traceability reporting |

## Scope Notes

- FinBank is an educational system, not a licensed payment processor.
- Mapping is conceptual and intentionally simplified for assignment requirements.
