import { useState, useEffect, useCallback } from "react";
import { Bell, Check, CheckCheck, Trash2, Loader2, ArrowLeft } from "lucide-react";
import { notificationApi } from "../services/api";
import { Link } from "react-router-dom";

export default function NotificationsPage() {
    const [notifs, setNotifs] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetch = useCallback(async () => {
        setLoading(true);
        try { const res = await notificationApi.list(); setNotifs(res.data); }
        catch { /* */ }
        setLoading(false);
    }, []);

    useEffect(() => { fetch(); }, [fetch]);

    const markAllRead = async () => {
        try { await notificationApi.markAllRead(); setNotifs((n) => n.map((x) => ({ ...x, read: true }))); }
        catch { /* */ }
    };

    const markRead = async (id) => {
        try {
            await notificationApi.markRead(id);
            setNotifs((n) => n.map((x) => x.notification_id === id ? { ...x, read: true } : x));
        } catch { /* */ }
    };

    const unreadCount = notifs.filter((n) => !n.read).length;

    const formatTime = (d) => {
        const date = new Date(d);
        return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    };

    const typeIcons = {
        "transfer": "💸",
        "security": "🔒",
        "kyc": "📄",
        "bill": "🧾",
        "system": "⚙️",
        "goal": "🎯",
        "default": "🔔",
    };

    return (
        <div style={{ padding: "24px", maxWidth: 700, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
                    <Bell size={28} color="#6366f1" /> Bildirimler
                    {unreadCount > 0 && (
                        <span style={{
                            background: "#ef4444", color: "#fff", fontSize: 12, fontWeight: 700,
                            padding: "2px 10px", borderRadius: 20,
                        }}>{unreadCount} okunmamış</span>
                    )}
                </h1>
                {unreadCount > 0 && (
                    <button onClick={markAllRead} style={{
                        padding: "8px 16px", borderRadius: 10, border: "none", cursor: "pointer",
                        background: "rgba(99,102,241,0.15)", color: "#6366f1", fontWeight: 600, fontSize: 13,
                        display: "flex", alignItems: "center", gap: 6,
                    }}>
                        <CheckCheck size={16} /> Tümünü Okundu İşaretle
                    </button>
                )}
            </div>

            {loading ? (
                <div style={{ textAlign: "center", padding: 60 }}><Loader2 size={28} style={{ animation: "spin 1s linear infinite" }} /></div>
            ) : notifs.length === 0 ? (
                <div style={{
                    textAlign: "center", padding: 60, color: "var(--text-secondary)",
                    background: "var(--bg-card)", borderRadius: 16,
                }}>
                    <Bell size={48} style={{ marginBottom: 12, opacity: 0.4 }} />
                    <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Bildirim bulunmuyor</h3>
                    <p style={{ fontSize: 14 }}>Henüz herhangi bir bildiriminiz yok.</p>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {notifs.map((n) => (
                        <div
                            key={n.notification_id}
                            onClick={() => !n.read && markRead(n.notification_id)}
                            style={{
                                background: n.read ? "var(--bg-card)" : "rgba(99,102,241,0.06)",
                                borderRadius: 14, padding: "16px 18px",
                                border: `1px solid ${n.read ? "var(--border-color)" : "rgba(99,102,241,0.2)"}`,
                                cursor: n.read ? "default" : "pointer",
                                transition: "all 0.2s",
                            }}
                        >
                            <div style={{ display: "flex", gap: 14, alignItems: "start" }}>
                                <span style={{ fontSize: 24, marginTop: 2 }}>{typeIcons[n.type] || typeIcons.default}</span>
                                <div style={{ flex: 1 }}>
                                    <p style={{
                                        fontSize: 14, fontWeight: n.read ? 400 : 600,
                                        lineHeight: 1.5, marginBottom: 4,
                                    }}>{n.message}</p>
                                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{formatTime(n.created_at)}</span>
                                </div>
                                {!n.read && (
                                    <span style={{
                                        width: 10, height: 10, borderRadius: "50%", background: "#6366f1",
                                        flexShrink: 0, marginTop: 6,
                                    }} />
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
