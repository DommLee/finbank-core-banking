import { useState } from "react";
import { Headphones, Send, MapPin, Phone, Mail, Clock, CheckCircle2, Loader2, MessageSquare } from "lucide-react";
import { messagesApi } from "../services/api";
import toast from "react-hot-toast";

export default function ContactPage() {
    const [form, setForm] = useState({ subject: "", body: "", category: "general" });
    const [submitting, setSubmitting] = useState(false);
    const [sent, setSent] = useState(false);

    const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.subject.trim() || !form.body.trim()) {
            toast.error("Konu ve mesaj alanları zorunludur.");
            return;
        }
        setSubmitting(true);
        try {
            await messagesApi.send(form);
            toast.success("Mesajınız gönderildi! ✅");
            setSent(true);
        } catch (err) {
            toast.error(err.response?.data?.detail || "Gönderilemedi.");
        }
        setSubmitting(false);
    };

    if (sent) {
        return (
            <div style={{ padding: 24, maxWidth: 600, margin: "0 auto" }}>
                <div style={{
                    background: "var(--bg-card)", borderRadius: 20, padding: 48,
                    border: "1px solid var(--border-color)", textAlign: "center",
                }}>
                    <CheckCircle2 size={56} color="#22c55e" style={{ marginBottom: 16 }} />
                    <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Mesajınız İletildi! ✅</h2>
                    <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
                        Destek ekibimiz en kısa sürede size dönüş yapacaktır. Ortalama yanıt süresi 2-4 saattir.
                    </p>
                    <button onClick={() => { setSent(false); setForm({ subject: "", body: "", category: "general" }); }}
                        style={primaryBtn}>Yeni Mesaj Gönder</button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
                <Headphones size={28} color="#6366f1" /> İletişim & Destek
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 28 }}>
                Sorularınız, önerileriniz veya şikayetleriniz için bize ulaşın.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {/* Contact Info Cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {[
                        { icon: <Phone size={20} />, label: "Telefon", val: "0850 123 4567", color: "#22c55e" },
                        { icon: <Mail size={20} />, label: "E-posta", val: "destek@finbank.com.tr", color: "#3b82f6" },
                        { icon: <MapPin size={20} />, label: "Merkez", val: "Levent, İstanbul", color: "#f59e0b" },
                        { icon: <Clock size={20} />, label: "Çalışma Saatleri", val: "09:00 - 18:00 (Hafta içi)", color: "#8b5cf6" },
                    ].map((c, i) => (
                        <div key={i} style={{
                            background: "var(--bg-card)", borderRadius: 16, padding: 18,
                            border: "1px solid var(--border-color)", display: "flex", alignItems: "center", gap: 14,
                        }}>
                            <div style={{
                                width: 44, height: 44, borderRadius: 12,
                                background: `${c.color}18`, display: "flex", alignItems: "center", justifyContent: "center",
                                color: c.color,
                            }}>{c.icon}</div>
                            <div>
                                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{c.label}</div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>{c.val}</div>
                            </div>
                        </div>
                    ))}

                    {/* FAQ */}
                    <div style={{
                        background: "var(--bg-card)", borderRadius: 16, padding: 18,
                        border: "1px solid var(--border-color)",
                    }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                            <MessageSquare size={18} color="#6366f1" /> Sık Sorulan Sorular
                        </h3>
                        {[
                            { q: "Hesap nasıl açılır?", a: "Panel → Hesaplar → Yeni Hesap Aç" },
                            { q: "KYC nedir?", a: "Kimlik doğrulama sürecidir, banka işlemleri için gereklidir." },
                            { q: "Şifre nasıl değiştirilir?", a: "Profil → Şifre Değiştir bölümünden yapabilirsiniz." },
                            { q: "2FA nasıl etkinleştirilir?", a: "Güvenlik Ayarları → 2FA sekmesinden Google Authenticator kullanın." },
                        ].map((faq, i) => (
                            <details key={i} style={{
                                marginBottom: 6, borderBottom: "1px solid var(--border-color)", paddingBottom: 6,
                            }}>
                                <summary style={{
                                    fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "6px 0",
                                    listStyle: "none", display: "flex", justifyContent: "space-between",
                                }}>{faq.q}</summary>
                                <p style={{ fontSize: 12, color: "var(--text-secondary)", padding: "4px 0 8px", lineHeight: 1.5 }}>{faq.a}</p>
                            </details>
                        ))}
                    </div>
                </div>

                {/* Contact Form */}
                <form onSubmit={handleSubmit} style={{
                    background: "var(--bg-card)", borderRadius: 20, padding: 24,
                    border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: 14,
                }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>📩 Mesaj Gönder</h3>

                    <div>
                        <label style={labelStyle}>Kategori</label>
                        <select name="category" value={form.category} onChange={handleChange} style={inputStyle}>
                            <option value="general">Genel</option>
                            <option value="technical">Teknik Destek</option>
                            <option value="complaint">Şikayet</option>
                            <option value="suggestion">Öneri</option>
                            <option value="account">Hesap İşlemleri</option>
                        </select>
                    </div>

                    <div>
                        <label style={labelStyle}>Konu *</label>
                        <input name="subject" value={form.subject} onChange={handleChange}
                            placeholder="Mesajınızın konusu" style={inputStyle} />
                    </div>

                    <div>
                        <label style={labelStyle}>Mesaj *</label>
                        <textarea name="body" value={form.body} onChange={handleChange}
                            placeholder="Detaylı olarak açıklayın..." rows={6}
                            style={{ ...inputStyle, resize: "vertical" }} />
                    </div>

                    <button type="submit" disabled={submitting} style={primaryBtn}>
                        {submitting ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Gönderiliyor...</> :
                            <><Send size={16} /> Gönder</>}
                    </button>
                </form>
            </div>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

const labelStyle = { fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" };
const inputStyle = { width: "100%", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14, outline: "none", boxSizing: "border-box" };
const primaryBtn = { padding: "12px 20px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 };
