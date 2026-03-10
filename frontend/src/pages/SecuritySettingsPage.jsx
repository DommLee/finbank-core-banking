import { useState, useEffect } from "react";
import { Shield, Smartphone, LogOut, Clock, Key, Loader2 } from "lucide-react";
import { sessionApi, loginHistoryApi, twoFactorApi } from "../services/api";
import toast from "react-hot-toast";

export default function SecuritySettingsPage() {
    const [tab, setTab] = useState("sessions");
    const [sessions, setSessions] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [twoFASetup, setTwoFASetup] = useState(null);
    const [totpCode, setTotpCode] = useState("");

    useEffect(() => {
        const fetch = async () => {
            setLoading(true);
            try {
                if (tab === "sessions") {
                    const res = await sessionApi.list();
                    setSessions(res.data);
                } else if (tab === "history") {
                    const res = await loginHistoryApi.list();
                    setHistory(res.data);
                }
            } catch { /* silently fail */ }
            setLoading(false);
        };
        fetch();
    }, [tab]);

    const killSession = async (id) => {
        try { await sessionApi.delete(id); toast.success("Oturum kapatıldı."); setSessions((s) => s.filter((x) => x.session_id !== id)); }
        catch { toast.error("Hata oluştu."); }
    };

    const killAll = async () => {
        if (!window.confirm("Tüm oturumları kapatmak istediğinize emin misiniz?")) return;
        try { await sessionApi.deleteAll(); toast.success("Tüm oturumlar kapatıldı."); setSessions([]); }
        catch { toast.error("Hata oluştu."); }
    };

    const setup2FA = async () => {
        try { const res = await twoFactorApi.setup(); setTwoFASetup(res.data); }
        catch { toast.error("2FA kurulumu başarısız."); }
    };

    const verify2FA = async () => {
        if (!totpCode) return;
        try { await twoFactorApi.verify(totpCode); toast.success("2FA etkinleştirildi! 🔒"); setTwoFASetup(null); setTotpCode(""); }
        catch { toast.error("Kod hatalı."); }
    };

    const disable2FA = async () => {
        if (!window.confirm("2FA'yı kapatmak güvenliğinizi azaltır. Emin misiniz?")) return;
        try { await twoFactorApi.disable(); toast.success("2FA devre dışı bırakıldı."); }
        catch { toast.error("Hata."); }
    };

    const tabs = [
        { id: "sessions", label: "Oturumlar", icon: <Smartphone size={16} /> },
        { id: "history", label: "Giriş Geçmişi", icon: <Clock size={16} /> },
        { id: "2fa", label: "2FA Ayarları", icon: <Key size={16} /> },
    ];

    const formatDate = (d) => new Date(d).toLocaleString("tr-TR");
    const parseUA = (ua) => {
        if (ua.includes("Chrome")) return "Chrome";
        if (ua.includes("Firefox")) return "Firefox";
        if (ua.includes("Safari")) return "Safari";
        return "Tarayıcı";
    };

    return (
        <div style={{ padding: "24px", maxWidth: 900, margin: "0 auto" }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
                <Shield size={28} color="#6366f1" /> Güvenlik Ayarları
            </h1>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 24, overflowX: "auto" }}>
                {tabs.map((t) => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{
                        padding: "10px 18px", borderRadius: 12, border: "none", cursor: "pointer",
                        background: tab === t.id ? "linear-gradient(135deg, #6366f1, #818cf8)" : "var(--bg-card)",
                        color: tab === t.id ? "#fff" : "var(--text-secondary)", fontWeight: 600, fontSize: 13,
                        display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
                    }}>
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {/* Sessions Tab */}
            {tab === "sessions" && (
                <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Aktif cihazlarınız</p>
                        {sessions.length > 0 && (
                            <button onClick={killAll} style={{ ...dangerBtn }}>
                                <LogOut size={14} /> Tümünü Kapat
                            </button>
                        )}
                    </div>
                    {loading ? <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} /> : (
                        sessions.length === 0 ? <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: 40 }}>Aktif oturum yok.</p> :
                            <div style={{ display: "grid", gap: 12 }}>
                                {sessions.map((s) => (
                                    <div key={s.session_id} style={{
                                        background: "var(--bg-card)", borderRadius: 14, padding: 18,
                                        border: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center",
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 14 }}>🖥️ {parseUA(s.user_agent)}</div>
                                            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>IP: {s.ip} • {formatDate(s.created_at)}</div>
                                        </div>
                                        <button onClick={() => killSession(s.session_id)} style={{ ...dangerBtn, padding: "6px 12px" }}>
                                            <LogOut size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                    )}
                </div>
            )}

            {/* Login History Tab */}
            {tab === "history" && (
                <div>
                    {loading ? <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} /> : (
                        history.length === 0 ? <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: 40 }}>Giriş geçmişi yok.</p> :
                            <div style={{ display: "grid", gap: 8 }}>
                                {history.map((h, i) => (
                                    <div key={i} style={{
                                        background: "var(--bg-card)", borderRadius: 12, padding: 14,
                                        border: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center",
                                    }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <span style={{
                                                width: 8, height: 8, borderRadius: "50%",
                                                background: h.success ? "#22c55e" : "#ef4444",
                                            }} />
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 500 }}>{h.success ? "✅ Başarılı giriş" : "❌ Başarısız deneme"}</div>
                                                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>IP: {h.ip} • {parseUA(h.user_agent)}</div>
                                            </div>
                                        </div>
                                        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{formatDate(h.timestamp)}</span>
                                    </div>
                                ))}
                            </div>
                    )}
                </div>
            )}

            {/* 2FA Tab */}
            {tab === "2fa" && (
                <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 28, border: "1px solid var(--border-color)" }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>🔐 İki Faktörlü Doğrulama (2FA)</h3>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
                        Google Authenticator veya benzeri bir uygulama ile hesabınıza ek güvenlik katmanı ekleyin.
                    </p>

                    {!twoFASetup ? (
                        <div style={{ display: "flex", gap: 12 }}>
                            <button onClick={setup2FA} style={{ ...primaryBtn }}>
                                <Key size={16} /> 2FA Kur
                            </button>
                            <button onClick={disable2FA} style={{ ...dangerBtn }}>
                                2FA Kapat
                            </button>
                        </div>
                    ) : (
                        <div>
                            <div style={{
                                background: "var(--bg-secondary)", borderRadius: 12, padding: 20, marginBottom: 16, textAlign: "center",
                            }}>
                                <p style={{ fontSize: 13, marginBottom: 12 }}>Bu kodu Google Authenticator'a manuel girin:</p>
                                <code style={{
                                    background: "var(--bg-tertiary)", padding: "8px 16px", borderRadius: 8,
                                    fontSize: 16, fontWeight: 700, letterSpacing: 2,
                                }}>{twoFASetup.secret}</code>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                                <input value={totpCode} onChange={(e) => setTotpCode(e.target.value)} placeholder="6 haneli kodu girin"
                                    maxLength={6} style={{ ...inputStyle, flex: 1 }} />
                                <button onClick={verify2FA} style={{ ...primaryBtn }}>Doğrula</button>
                            </div>
                        </div>
                    )}
                </div>
            )}
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

const inputStyle = { padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14, outline: "none" };
const primaryBtn = { padding: "10px 20px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #818cf8)", color: "#fff", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 };
const dangerBtn = { padding: "10px 16px", borderRadius: 12, border: "none", background: "#ef4444", color: "#fff", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 };
