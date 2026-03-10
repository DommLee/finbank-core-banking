import { useState } from "react";
import { Headphones, Mail, Phone, MapPin, Send, MessageSquare, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";
import { messagesApi } from "../../services/api";
import { toast } from "react-hot-toast";

const FAQ = [
    { q: "Hesap açmak için ne gerekli?", a: "TC Kimlik numaranız ve geçerli bir e-posta adresiniz ile kayıt olduktan sonra KYC sürecini tamamlamanız yeterlidir." },
    { q: "Para transferi ne kadar sürer?", a: "FinBank içi transferler anında gerçekleşir. Diğer banka transferleri için EFT saatleri geçerlidir (08:30 - 17:30)." },
    { q: "Kredi kartı limitimi nasıl artırırım?", a: "Kredi kartı limit artışı için müşteri temsilcinizle iletişime geçebilir veya mesaj gönderebilirsiniz." },
    { q: "Şifremi unuttum, ne yapmalıyım?", a: "Giriş ekranında 'Şifremi Unuttum' bağlantısına tıklayarak kayıtlı e-posta adresinize sıfırlama bağlantısı alabilirsiniz." },
    { q: "Hesabım donduruldu, ne yapmalıyım?", a: "Güvenlik nedeniyle dondurulan hesaplar için lütfen destek ekibimize mesaj gönderin veya 0850 123 45 67 numarasını arayın." },
];

export default function CustomerSupportPage() {
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [openFaq, setOpenFaq] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!subject.trim() || !message.trim()) {
            toast.error("Lütfen tüm alanları doldurun.");
            return;
        }
        setLoading(true);
        try {
            await messagesApi.send({ subject, body: message });
            toast.success("Mesajınız başarıyla gönderildi! 📩");
            setSubject("");
            setMessage("");
        } catch (error) {
            toast.error("Mesaj gönderilemedi. Lütfen tekrar deneyin.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
                <Headphones size={28} color="#ef4444" />
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Destek & İletişim</h1>
                    <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>Size yardımcı olmaktan mutluluk duyarız.</p>
                </div>
            </div>

            {/* Contact Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 32 }}>
                {[
                    { icon: <Phone size={20} />, label: "Telefon", value: "0850 123 45 67", sub: "7/24 Hizmet" },
                    { icon: <Mail size={20} />, label: "E-Posta", value: "destek@finbank.com", sub: "24 saat içinde yanıt" },
                    { icon: <MapPin size={20} />, label: "Adres", value: "Levent, İstanbul", sub: "Merkez Şube" },
                ].map((item, i) => (
                    <div key={i} style={{
                        background: "var(--bg-card)", borderRadius: 16, padding: 20,
                        border: "1px solid var(--border-color)", display: "flex", gap: 14, alignItems: "center",
                    }}>
                        <div style={{
                            width: 44, height: 44, borderRadius: 12, background: "rgba(239,68,68,0.1)",
                            display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444",
                        }}>
                            {item.icon}
                        </div>
                        <div>
                            <div style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1 }}>{item.label}</div>
                            <div style={{ fontSize: 15, fontWeight: 600 }}>{item.value}</div>
                            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{item.sub}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                {/* Message Form */}
                <div style={{
                    background: "var(--bg-card)", borderRadius: 20, padding: 28,
                    border: "1px solid var(--border-color)",
                }}>
                    <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                        <MessageSquare size={20} color="#ef4444" /> Bize Yazın
                    </h2>
                    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Konu"
                            required
                            style={{
                                padding: "12px 16px", borderRadius: 12,
                                border: "1px solid var(--border-color)", background: "var(--bg-secondary)",
                                color: "var(--text-primary)", fontSize: 14, outline: "none",
                            }}
                        />
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Mesajınızı buraya yazın..."
                            rows={5}
                            required
                            style={{
                                padding: "12px 16px", borderRadius: 12,
                                border: "1px solid var(--border-color)", background: "var(--bg-secondary)",
                                color: "var(--text-primary)", fontSize: 14, outline: "none", resize: "vertical",
                            }}
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                padding: "14px", borderRadius: 12, border: "none",
                                background: "linear-gradient(135deg, #ef4444, #dc2626)",
                                color: "white", fontSize: 15, fontWeight: 600, cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                                opacity: loading ? 0.7 : 1,
                            }}
                        >
                            <Send size={18} /> {loading ? "Gönderiliyor..." : "Mesaj Gönder"}
                        </button>
                    </form>
                </div>

                {/* FAQ */}
                <div style={{
                    background: "var(--bg-card)", borderRadius: 20, padding: 28,
                    border: "1px solid var(--border-color)",
                }}>
                    <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                        <HelpCircle size={20} color="#6366f1" /> Sık Sorulan Sorular
                    </h2>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {FAQ.map((item, i) => (
                            <div key={i} style={{
                                borderRadius: 12, border: "1px solid var(--border-color)",
                                overflow: "hidden", transition: "all 0.2s",
                            }}>
                                <button
                                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                    style={{
                                        width: "100%", padding: "14px 16px", background: "transparent",
                                        border: "none", display: "flex", justifyContent: "space-between",
                                        alignItems: "center", cursor: "pointer", color: "var(--text-primary)",
                                        fontSize: 14, fontWeight: 500, textAlign: "left",
                                    }}
                                >
                                    {item.q}
                                    {openFaq === i ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>
                                {openFaq === i && (
                                    <div style={{
                                        padding: "0 16px 14px", fontSize: 13, lineHeight: 1.6,
                                        color: "var(--text-secondary)", borderTop: "1px solid var(--border-color)",
                                        paddingTop: 12,
                                    }}>
                                        {item.a}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
