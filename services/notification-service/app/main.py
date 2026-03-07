"""
FinBank Notification Service â€” Messages, Email, WebSocket Notifications
Port: 8003
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, List
from datetime import datetime, timezone
import os, sys, uuid, json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from shared.database import connect_to_mongo, close_mongo_connection, get_database
from shared.jwt_utils import get_current_user, decode_token
from shared.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.validate_runtime_settings()
    db = await connect_to_mongo()
    await db.messages.create_index("sender_id")
    await db.messages.create_index("receiver_role")
    await db.messages.create_index("created_at")
    await db.notifications.create_index("user_id")
    await db.notifications.create_index("read")
    yield
    await close_mongo_connection()


app = FastAPI(title="FinBank Notification Service", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins_list, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active: Dict[str, List[WebSocket]] = {}

    async def connect(self, ws: WebSocket, user_id: str):
        await ws.accept()
        if user_id not in self.active:
            self.active[user_id] = []
        self.active[user_id].append(ws)

    def disconnect(self, ws: WebSocket, user_id: str):
        if user_id in self.active:
            self.active[user_id] = [w for w in self.active[user_id] if w != ws]

    async def send_to_user(self, user_id: str, message: dict):
        if user_id in self.active:
            for ws in self.active[user_id]:
                try:
                    await ws.send_json(message)
                except Exception:
                    pass

manager = ConnectionManager()


# â”€â”€ Models â”€â”€
class MessageSendRequest(BaseModel):
    receiver_role: str = "employee"
    subject: str
    body: str

class ReplyRequest(BaseModel):
    reply_body: str


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "notification-service"}


# â”€â”€ Messages â”€â”€
@app.post("/messages")
async def send_message(body: MessageSendRequest, current_user=Depends(get_current_user), db=Depends(get_database)):
    doc = {
        "message_id": str(uuid.uuid4()),
        "sender_id": current_user["user_id"],
        "sender_email": current_user["email"],
        "sender_role": current_user["role"],
        "receiver_role": body.receiver_role,
        "subject": body.subject,
        "body": body.body,
        "status": "open",
        "reply": None,
        "reply_by": None,
        "reply_at": None,
        "read": False,
        "created_at": datetime.now(timezone.utc),
    }
    await db.messages.insert_one(doc)
    return {"message": "MesajÄ±nÄ±z gÃ¶nderildi âœ…", "message_id": doc["message_id"]}


@app.get("/messages/inbox")
async def get_inbox(current_user=Depends(get_current_user), db=Depends(get_database)):
    role = current_user["role"]
    if role == "customer":
        query = {"sender_id": current_user["user_id"]}
    else:
        query = {"receiver_role": {"$in": [role, "employee"]}}

    messages = await db.messages.find(query).sort("created_at", -1).to_list(50)
    for m in messages:
        m["_id"] = str(m["_id"])
    return messages


@app.post("/messages/{message_id}/reply")
async def reply_message(message_id: str, body: ReplyRequest, current_user=Depends(get_current_user), db=Depends(get_database)):
    msg = await db.messages.find_one({"message_id": message_id})
    if not msg:
        raise HTTPException(404, "Mesaj bulunamadÄ±.")

    await db.messages.update_one({"message_id": message_id}, {"$set": {
        "reply": body.reply_body,
        "reply_by": current_user["email"],
        "reply_at": datetime.now(timezone.utc),
        "status": "replied",
    }})

    # Real-time notification to sender
    await manager.send_to_user(msg["sender_id"], {
        "type": "message_reply",
        "message": f"MesajÄ±nÄ±za yanÄ±t geldi: {msg['subject']}",
    })

    return {"message": "YanÄ±t gÃ¶nderildi âœ…"}


@app.patch("/messages/{message_id}/read")
async def mark_read(message_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    await db.messages.update_one({"message_id": message_id}, {"$set": {"read": True}})
    return {"message": "Okundu olarak iÅŸaretlendi."}


# â”€â”€ Notifications â”€â”€
@app.get("/notifications")
async def list_notifications(current_user=Depends(get_current_user), db=Depends(get_database)):
    notifs = await db.notifications.find(
        {"user_id": current_user["user_id"]}
    ).sort("created_at", -1).to_list(30)
    for n in notifs:
        n["_id"] = str(n["_id"])
    return notifs


@app.get("/notifications/unread-count")
async def unread_count(current_user=Depends(get_current_user), db=Depends(get_database)):
    count = await db.notifications.count_documents({
        "user_id": current_user["user_id"], "read": False
    })
    return {"count": count}


@app.patch("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    await db.notifications.update_one(
        {"notification_id": notification_id}, {"$set": {"read": True}}
    )
    return {"message": "Bildirim okundu."}


@app.patch("/notifications/read-all")
async def mark_all_read(current_user=Depends(get_current_user), db=Depends(get_database)):
    await db.notifications.update_many(
        {"user_id": current_user["user_id"], "read": False},
        {"$set": {"read": True}}
    )
    return {"message": "TÃ¼m bildirimler okundu."}


# â”€â”€ WebSocket â”€â”€
@app.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    try:
        payload = decode_token(token)
        user_id = payload.get("user_id")
        if not user_id:
            await websocket.close()
            return
    except Exception:
        await websocket.close()
        return

    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Keep-alive / ping-pong
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
