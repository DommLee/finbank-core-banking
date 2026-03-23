# FinBank — Error Codes & Handling Reference

## HTTP Error Response Format

All error responses follow a consistent JSON structure:

```json
{
  "detail": "Human-readable error message"
}
```

## Error Codes Reference

### Authentication Errors (401)

| Error | Cause | Resolution |
|---|---|---|
| `Invalid or expired Supabase token` | JWT token expired or malformed | Re-login to get a new token |
| `Token payload missing email` | Token doesn't contain email claim | Contact admin |
| `User not found in local database` | Auth user exists but local record missing | Re-register |

### Authorization Errors (403)

| Error | Cause | Resolution |
|---|---|---|
| `Access denied. Required role: admin` | User doesn't have admin privileges | Login as admin |
| `Access denied. Required role: customer` | User doesn't have customer privileges | Login as customer |
| `User account is deactivated` | Account has been disabled by admin | Contact admin |

### Business Logic Errors (400)

| Error | Cause | Resolution |
|---|---|---|
| `Insufficient funds` | Account balance < requested amount | Deposit more funds |
| `Same account transfer` | Source and destination accounts are identical | Use a different target |
| `Invalid amount` | Amount <= 0 or > 1,000,000 | Use valid amount range |

### Not Found Errors (404)

| Error | Cause | Resolution |
|---|---|---|
| `Account not found` | Invalid account ID provided | Check account ID |
| `Customer not found` | No customer profile for this user | Create customer profile first |

### Conflict Errors (409)

| Error | Cause | Resolution |
|---|---|---|
| `Email already registered` | Duplicate registration attempt | Login instead |
| `Duplicate transaction` | Idempotency key collision | Wait and retry with new key |
| `Account already frozen` | Account is already in frozen state | Unfreeze first |

## Domain Exception Classes

All exceptions defined in `backend/app/core/exceptions.py`:

| Exception Class | HTTP Code | Usage |
|---|---|---|
| `InsufficientFundsError` | 400 | Balance < requested amount |
| `AccountNotFoundError` | 404 | Invalid account_id |
| `AccountFrozenError` | 403 | Account is frozen or closed |
| `SameAccountTransferError` | 400 | from_account == to_account |
| `DuplicateTransactionError` | 409 | Idempotency violation |

## Rate Limiting Errors (429)

| Endpoint Group | Limit | Response |
|---|---|---|
| Authentication (`/auth/*`) | 5 requests / minute | `Too Many Requests` |
| General endpoints | 60 requests / minute | `Too Many Requests` |
