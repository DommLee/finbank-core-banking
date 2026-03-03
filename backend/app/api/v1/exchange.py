import httpx
from fastapi import APIRouter
from datetime import datetime, timezone, timedelta
from typing import Dict, Any

router = APIRouter()

# Simple in-memory cache to avoid spamming the public API
CACHE = {
    "data": None,
    "last_fetched": None
}
CACHE_TTL = timedelta(hours=1)

@router.get("/rates")
async def get_exchange_rates() -> Dict[str, Any]:
    """
    Fetch latest exchange rates for TRY against major currencies (USD, EUR, GBP) + mocked Gold.
    Uses open.er-api.com (no key required) with simple fallback and 1-hour cache.
    """
    now = datetime.now(timezone.utc)
    
    if CACHE["data"] and CACHE["last_fetched"] and (now - CACHE["last_fetched"]) < CACHE_TTL:
        return CACHE["data"]

    # Default fallback rates in case API fails
    fallback_rates = {
        "status": "success",
        "base": "TRY",
        "rates": {
            "USD": 32.50,
            "EUR": 35.20,
            "GBP": 41.10,
            "CHF": 36.00,
            "XAU": 76375.0,
            "TRY": 1.0
        },
        "last_update": now.isoformat()
    }

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            # We want rates where base is TRY.
            response = await client.get("https://open.er-api.com/v6/latest/TRY")
            if response.status_code == 200:
                data = response.json()
                raw = data.get("rates", {})
                
                # The API returns 1 TRY = X foreign. We want 1 foreign = Y TRY (invert).
                usd_rate = 1 / raw["USD"] if raw.get("USD") else 32.50
                eur_rate = 1 / raw["EUR"] if raw.get("EUR") else 35.20
                gbp_rate = 1 / raw["GBP"] if raw.get("GBP") else 41.10
                chf_rate = 1 / raw["CHF"] if raw.get("CHF", 0) else 36.00
                xau_rate = usd_rate * 2350  # Approximate gold price per ounce in TRY
                
                response_data = {
                    "status": "success",
                    "base": "TRY",
                    "rates": {
                        "USD": round(usd_rate, 4),
                        "EUR": round(eur_rate, 4),
                        "GBP": round(gbp_rate, 4),
                        "CHF": round(chf_rate, 4),
                        "XAU": round(xau_rate, 2),
                        "TRY": 1.0
                    },
                    "last_update": now.isoformat()
                }
                
                CACHE["data"] = response_data
                CACHE["last_fetched"] = now
                return response_data
    except Exception as e:
        print(f"Error fetching exchange rates: {e}")
        # Return fallback on error
        pass
        
    return fallback_rates
