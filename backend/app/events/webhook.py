"""
FinBank - Webhook Event Sender (Event-Driven via HTTP POST)
"""
import httpx
import structlog
from datetime import datetime, timezone
from typing import Any, Dict
from tenacity import retry, stop_after_attempt, wait_exponential
from app.core.config import settings

logger = structlog.get_logger()


class WebhookEvent:
    """Represents a webhook event to be sent to external consumers."""

    TRANSFER_CREATED = "TransferCreated"
    TRANSFER_COMPLETED = "TransferCompleted"
    ACCOUNT_DEBITED = "AccountDebited"
    ACCOUNT_CREDITED = "AccountCredited"
    ACCOUNT_CREATED = "AccountCreated"
    DEPOSIT_COMPLETED = "DepositCompleted"
    WITHDRAWAL_COMPLETED = "WithdrawalCompleted"


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    reraise=True,
)
async def _send_webhook_with_retry(url: str, payload: dict):
    """Send webhook with retry logic."""
    async with httpx.AsyncClient(timeout=settings.WEBHOOK_TIMEOUT) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        return response


async def send_webhook(event: str, payload: Dict[str, Any]):
    """
    Send a webhook event to the configured external URL.
    Non-blocking: failures are logged but don't break the transaction.
    """
    webhook_data = {
        "event": event,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "payload": payload,
    }

    if not settings.WEBHOOK_URL:
        logger.debug("Webhook URL not configured, skipping", event=event)
        return

    try:
        await _send_webhook_with_retry(settings.WEBHOOK_URL, webhook_data)
        logger.info(
            "Webhook sent successfully",
            event=event,
            url=settings.WEBHOOK_URL,
        )
    except Exception as e:
        # Log but don't raise - webhooks should never block transactions
        logger.warning(
            "Webhook delivery failed",
            event=event,
            error=str(e),
            url=settings.WEBHOOK_URL,
        )


async def publish_transfer_events(
    transfer_id: str,
    from_account: str,
    to_account: str,
    amount: float,
    currency: str = "TRY",
):
    """Publish all events related to a transfer."""
    base_payload = {
        "transfer_id": transfer_id,
        "from_account": from_account,
        "to_account": to_account,
        "amount": amount,
        "currency": currency,
    }

    # Send all 4 required events
    await send_webhook(WebhookEvent.TRANSFER_CREATED, base_payload)
    await send_webhook(WebhookEvent.ACCOUNT_DEBITED, {
        "account_id": from_account,
        "amount": amount,
        "transfer_id": transfer_id,
    })
    await send_webhook(WebhookEvent.ACCOUNT_CREDITED, {
        "account_id": to_account,
        "amount": amount,
        "transfer_id": transfer_id,
    })
    await send_webhook(WebhookEvent.TRANSFER_COMPLETED, base_payload)
