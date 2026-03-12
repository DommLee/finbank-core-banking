import { useState, useEffect } from "react";
import { Send, MessageSquare, Reply, Clock, CheckCircle } from "lucide-react";
import { messagesApi } from "../services/api";
import toast from "react-hot-toast";

export default function MessagesPage({ userRole = "customer" }) {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(userRole === "customer" ? "send" : "inbox");
    const [form, setForm] = useState({ subject: "", body: "" });
    const [replyingTo, setReplyingTo] = useState(null);
    const [replyText, setReplyText] = useState("");
    const [sending, setSending] = useState(false);

    useEffect(() => { loadInbox(); }, []);

    const loadInbox = async () => {
        try {
            const res = await messagesApi.inbox();
            setMessages(Array.isArray(res.data) ? res.data : []);
        } catch { setMessages([]); }
        finally { setLoading(false); }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!form.subject.trim() || !form.body.trim()) return;
        setSending(true);
        try {
            await messagesApi.send({ subject: form.subject, body: form.body, to_role: "employee" });
            toast.success("Mesajınız gönderildi! 📩");
            setForm({ subject: "", body: "" });
            loadInbox();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Gönderilemedi.");
        } finally { setSending(false); }
    };

    const handleReply = async (msgId) => {
        if (!replyText.trim()) return;
        setSending(true);
        try {
            await messagesApi.reply(msgId, { reply: replyText });
            toast.success("Yanıt gönderildi! ✅");
            setReplyingTo(null);
            setReplyText("");
            loadInbox();
        } catch (err) {
            toast.error("Yanıt gönderilemedi.");
        } finally { setSending(false); }
    };

    const formatDate = (d) => {
        if (!d) return "";
        return new Date(d).toLocaleDateString("tr-TR", {
            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
        });
    };

    return (
        <div className="page-container" style={{ maxWidth: 900 }}>
            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>
                    📩 Mesajlar
                </h1>
                <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
                    {userRole === "customer" ? "Destek ekibimize mesaj gönderin." : "Müşteri mesajlarını yönetin."}
                </p>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20, overflowX: "auto" }}>
                {userRole === "customer" && (
                    <TabBtn active={activeTab === "send"} onClick={() => setActiveTab("send")}>
                        ✏️ Yeni Mesaj
                    </TabBtn>
                )}
                <TabBtn active={activeTab === "inbox"} onClick={() => setActiveTab("inbox")}>
                    📥 {userRole === "customer" ? "Mesajlarım" : "Gelen Kutusu"} ({messages.length})
                </TabBtn>
            </div>

            {/* Send Form (Customer) */}
            {activeTab === "send" && userRole === "customer" && (
                <div className="card" style={{ padding: 24 }}>
                    <form onSubmit={handleSend}>
                        <div className="form-group">
                            <label className="form-label">Konu</label>
                            <input
                                className="form-input"
                                placeholder="Mesajınızın konusu..."
                                value={form.subject}
                                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Mesaj</label>
                            <textarea
                                className="form-input"
                                placeholder="Mesajınızı yazın..."
                                rows={5}
                                style={{ resize: "vertical" }}
                                value={form.body}
                                onChange={(e) => setForm({ ...form, body: e.target.value })}
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={sending}
                            style={{ display: "flex", alignItems: "center", gap: 8 }}
                        >
                            <Send size={16} />
                            {sending ? "Gönderiliyor..." : "Gönder"}
                        </button>
                    </form>
                </div>
            )}

            {/* Inbox */}
            {activeTab === "inbox" && (
                <div>
                    {loading ? (
                        <div style={{ textAlign: "center", padding: 40 }}>
                            <div className="spinner" style={{ width: 30, height: 30 }} />
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="card" style={{ padding: 40, textAlign: "center" }}>
                            <MessageSquare size={40} style={{ color: "var(--text-muted)", marginBottom: 12 }} />
                            <p style={{ color: "var(--text-muted)" }}>Henüz mesaj yok.</p>
                        </div>
                    ) : (
                        messages.map((msg, i) => (
                            <div key={msg.message_id || i} className="glass-card" style={{
                                padding: 24, marginBottom: 16,
                                borderLeft: msg.reply ? "4px solid var(--success)" : msg.read ? "1px solid var(--glass-border)" : "4px solid var(--accent)",
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 15 }}>{msg.subject}</div>
                                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                            {msg.from_email} · {formatDate(msg.created_at)}
                                        </div>
                                    </div>
                                    {msg.reply ? (
                                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "rgba(16,185,129,0.15)", color: "#10b981", fontWeight: 600 }}>
                                            <CheckCircle size={12} /> Yanıtlandı
                                        </span>
                                    ) : (
                                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "rgba(245,158,11,0.15)", color: "#f59e0b", fontWeight: 600 }}>
                                            <Clock size={12} /> Bekliyor
                                        </span>
                                    )}
                                </div>

                                <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)", marginBottom: 8 }}>
                                    {msg.body}
                                </p>

                                {msg.reply && (
                                    <div style={{
                                        background: "rgba(16, 185, 129, 0.05)", borderRadius: 12, padding: 16, marginTop: 12,
                                        borderLeft: "3px solid var(--success)",
                                        border: "1px solid var(--glass-border)"
                                    }}>
                                        <div style={{ fontSize: 13, color: "var(--success)", fontWeight: 700, marginBottom: 6 }}>
                                            ↩ Yanıt ({msg.replied_by})
                                        </div>
                                        <p style={{ fontSize: 13, color: "var(--text-primary)" }}>{msg.reply}</p>
                                    </div>
                                )}

                                {/* Reply section for staff */}
                                {userRole !== "customer" && !msg.reply && (
                                    <>
                                        {replyingTo === msg.message_id ? (
                                            <div style={{ marginTop: 12 }}>
                                                <textarea
                                                    className="form-input"
                                                    rows={3}
                                                    placeholder="Yanıtınızı yazın..."
                                                    value={replyText}
                                                    onChange={(e) => setReplyText(e.target.value)}
                                                    style={{ marginBottom: 8 }}
                                                />
                                                <div style={{ display: "flex", gap: 8 }}>
                                                    <button
                                                        className="btn btn-primary"
                                                        onClick={() => handleReply(msg.message_id)}
                                                        disabled={sending}
                                                        style={{ fontSize: 13, padding: "6px 14px" }}
                                                    >
                                                        <Send size={14} /> Gönder
                                                    </button>
                                                    <button
                                                        onClick={() => { setReplyingTo(null); setReplyText(""); }}
                                                        style={{
                                                            background: "rgba(255, 255, 255, 0.05)", border: "1px solid var(--glass-border)",
                                                            borderRadius: 14, padding: "8px 16px", fontSize: 13, fontWeight: 600,
                                                            color: "var(--text-primary)", cursor: "pointer", backdropFilter: "var(--glass-blur)"
                                                        }}
                                                    >
                                                        İptal
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setReplyingTo(msg.message_id)}
                                                style={{
                                                    marginTop: 12, background: "rgba(59, 130, 246, 0.1)", border: "1px solid var(--accent)",
                                                    borderRadius: 12, padding: "8px 16px", fontSize: 13, fontWeight: 600,
                                                    color: "var(--accent)", cursor: "pointer",
                                                    display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s"
                                                }}
                                            >
                                                <Reply size={16} /> Yanıtla
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

function TabBtn({ active, onClick, children }) {
    return (
        <button
            onClick={onClick}
            style={{
                padding: "10px 20px", borderRadius: 14, border: "1px solid var(--glass-border)",
                fontWeight: 700, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap",
                background: active ? "linear-gradient(135deg, var(--accent), #818cf8)" : "rgba(255, 255, 255, 0.05)",
                color: active ? "#fff" : "var(--text-secondary)",
                backdropFilter: "var(--glass-blur)",
                transition: "all 0.2s ease",
            }}
        >
            {children}
        </button>
    );
}
