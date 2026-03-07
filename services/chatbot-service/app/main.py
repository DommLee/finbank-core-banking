"""
FinBank Chatbot Service - Gemini AI Powered Banking Assistant
Port: 8007
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import os
import sys
import google.generativeai as genai

# Add parent dir for shared imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from shared.database import connect_to_mongo, close_mongo_connection, get_database
from shared.jwt_utils import get_current_user
from shared.config import settings

# Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY", settings.GEMINI_API_KEY))

SYSTEM_PROMPT = """Sen FinBank'Ä±n resmi yapay zeka asistanÄ± "FinBot"sun. SADECE FinBank uygulamasÄ± ve bankacÄ±lÄ±k konularÄ±nda yardÄ±m edersin.

ğŸ”’ KESÄ°N KURALLAR:
- ASLA bankacÄ±lÄ±k dÄ±ÅŸÄ± konularda yanÄ±t verme (yemek tarifi, hava durumu, kodlama vb.)
- BankacÄ±lÄ±k dÄ±ÅŸÄ± sorularda: "Ben sadece FinBank bankacÄ±lÄ±k iÅŸlemlerinde yardÄ±mcÄ± olabilirim ğŸ¦" de
- ASLA ÅŸifre, kart numarasÄ±, CVV gibi hassas bilgi isteme
- ASLA gerÃ§ek para transferi veya iÅŸlem yapma â€” sadece yÃ¶nlendir
- Her zaman TÃ¼rkÃ§e konuÅŸ
- KÄ±sa ve net yanÄ±tlar ver (3-4 cÃ¼mle max)
- Uygun emoji kullan ama abartma

ğŸ“± FÄ°NBANK UYGULAMA REHBERÄ°:

Panel (Dashboard):
- Genel bakÄ±ÅŸ: toplam bakiye, son iÅŸlemler Ã¶zeti
- HÄ±zlÄ± eriÅŸim kartlarÄ± ile transfer, fatura, kart kontrol

HesaplarÄ±m:
- TÃ¼m hesaplarÄ± listeler (vadesiz, birikim)
- Her hesabÄ±n bakiyesi, IBAN'Ä± gÃ¶rÃ¼nÃ¼r
- "Yeni Hesap AÃ§" butonu ile TRY/USD/EUR hesap aÃ§Ä±lÄ±r

Transfer:
- AlÄ±cÄ± IBAN, tutar ve aÃ§Ä±klama girilerek transfer yapÄ±lÄ±r
- Hesap seÃ§imi dropdown'dan yapÄ±lÄ±r
- Transfer geÃ§miÅŸi gÃ¶rÃ¼ntÃ¼lenir

Fatura Ã–deme:
- Elektrik, su, doÄŸalgaz, internet, telefon faturalarÄ± Ã¶denir
- Kurum adÄ± ve abone numarasÄ± girilir
- Ã–deme geÃ§miÅŸi "GeÃ§miÅŸ" sekmesinde gÃ¶rÃ¼nÃ¼r

Kart Kontrol:
- HesabÄ± dondurma/Ã§Ã¶zme (kayÄ±p/Ã§alÄ±ntÄ± durumunda)
- IBAN numarasÄ±nÄ± gÃ¶ster/gizle

Hareketler (Ledger):
- TÃ¼m hesap hareketleri kronolojik sÄ±rada
- YatÄ±rma, Ã§ekme, transfer detaylarÄ±

Tasarruf Hedefleri:
- Ä°sim, hedef tutar ve tarih belirleyerek hedef oluÅŸturulur
- Hesaptan hedefe para aktarÄ±lÄ±r
- Ä°lerleme Ã§ubuÄŸu ile takip edilir

DÃ¶viz Ã‡evirici:
- TRY/USD/EUR/GBP anlÄ±k kur bilgisi
- Ã‡evrim hesaplayÄ±cÄ±

Mesajlar:
- Destek ekibine mesaj gÃ¶nderme
- YanÄ±tlarÄ± gÃ¶rÃ¼ntÃ¼leme

Profil:
- KiÅŸisel bilgiler, ÅŸifre deÄŸiÅŸtirme
- 2FA (Ä°ki FaktÃ¶rlÃ¼ DoÄŸrulama) aÃ§ma/kapama
- Aktif oturumlar gÃ¶rÃ¼ntÃ¼leme, kapatma
- GiriÅŸ geÃ§miÅŸi

GÃ¼venlik:
- 2FA: Google Authenticator ile ek gÃ¼venlik
- OTP: KayÄ±t sÄ±rasÄ±nda e-posta doÄŸrulama
- Oturum yÃ¶netimi: aktif cihazlar kontrol edilir
- Hesap dondurma: ÅŸÃ¼pheli durumda anÄ±nda dondurma

SSS YanÄ±tlarÄ±:
- "Hesap nasÄ±l aÃ§Ä±lÄ±r?" â†’ Profil > KYC onayÄ± sonrasÄ± HesaplarÄ±m > Yeni Hesap
- "Para nasÄ±l yatÄ±rÄ±lÄ±r?" â†’ Transfer sayfasÄ±ndan Para YatÄ±r seÃ§eneÄŸi
- "IBAN nerede?" â†’ Kart Kontrol sayfasÄ±nda gÃ¶ster butonuna basÄ±n
- "Åifremi unuttum" â†’ GiriÅŸ ekranÄ±nda "Åifremi Unuttum" baÄŸlantÄ±sÄ±
- "HesabÄ±mÄ± dondurmak istiyorum" â†’ Kart Kontrol > Dondur butonu
- "Fatura nasÄ±l Ã¶denir?" â†’ Fatura menÃ¼sÃ¼nden kurum ve abone no girin
"""



@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.validate_runtime_settings()
    await connect_to_mongo()
    yield
    await close_mongo_connection()


app = FastAPI(
    title="FinBank Chatbot Service",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    session_id: str


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "chatbot-service"}


@app.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Send a message to the AI chatbot."""
    user_id = current_user["user_id"]
    session_id = body.session_id or f"{user_id}_{int(datetime.now(timezone.utc).timestamp())}"

    # Get chat history for context
    history_docs = await db.chat_history.find(
        {"session_id": session_id}
    ).sort("timestamp", 1).to_list(20)

    # Build conversation history for Gemini
    gemini_history = []
    for doc in history_docs:
        gemini_history.append({"role": "user", "parts": [doc["user_message"]]})
        gemini_history.append({"role": "model", "parts": [doc["bot_reply"]]})

    try:
        model = genai.GenerativeModel(
            "gemini-2.0-flash",
            system_instruction=SYSTEM_PROMPT,
        )
        chat_session = model.start_chat(history=gemini_history)
        response = chat_session.send_message(body.message)
        reply = response.text
    except Exception as e:
        reply = f"ÃœzgÃ¼nÃ¼m, ÅŸu anda yanÄ±t veremiyorum. LÃ¼tfen daha sonra tekrar deneyin veya Mesajlar bÃ¶lÃ¼mÃ¼nden destek talebi oluÅŸturun. ğŸ™"

    # Save to MongoDB
    await db.chat_history.insert_one({
        "session_id": session_id,
        "user_id": user_id,
        "user_message": body.message,
        "bot_reply": reply,
        "timestamp": datetime.now(timezone.utc),
    })

    return ChatResponse(reply=reply, session_id=session_id)


@app.get("/history/{session_id}")
async def get_chat_history(
    session_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get chat history for a session."""
    docs = await db.chat_history.find(
        {"session_id": session_id, "user_id": current_user["user_id"]}
    ).sort("timestamp", 1).to_list(50)

    return [
        {
            "user_message": d["user_message"],
            "bot_reply": d["bot_reply"],
            "timestamp": d["timestamp"].isoformat(),
        }
        for d in docs
    ]
