import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { customerApi } from "../services/api";
import {
    FileCheck, Upload, AlertCircle, CheckCircle2, Clock,
    XCircle, User, CreditCard, Loader2,
} from "lucide-react";
import toast from "react-hot-toast";

export default function KYCPage() {
    const { user } = useAuth();
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({
        first_name: "",
        last_name: "",
        national_id: "",
        phone: "",
        birth_date: "",
        address: "",
        id_front_url: "",
        id_back_url: "",
    });

    useEffect(() => {
        const load = async () => {
            try {
                const res = await customerApi.getProfile();
                const data = res.data;
                setStatus(data.status);
                if (data.first_name) {
                    setForm((f) => ({
                        ...f,
                        first_name: data.first_name || "",
                        last_name: data.last_name || "",
                        national_id: data.national_id || "",
                        phone: data.phone || "",
                    }));
                }
            } catch {
                setStatus("not_started");
            }
            setLoading(false);
        };
        load();
    }, []);

    const handleChange = (e) => {
        setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async () => {
        if (!form.first_name || !form.last_name || !form.national_id || !form.phone) {
            toast.error("Lütfen tüm zorunlu alanları doldurun.");
            return;
        }
        if (form.national_id.length !== 11) {
            toast.error("TC Kimlik No 11 haneli olmalıdır.");
            return;
        }
        setSubmitting(true);
        try {
            await customerApi.submitKYC(form);
            toast.success("KYC başvurunuz gönderildi! ✅");
            setStatus("pending");
        } catch (err) {
            toast.error(err.response?.data?.detail || "Başvuru gönderilemedi.");
        }
        setSubmitting(false);
    };

    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
                <Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} />
            </div>
        );
    }

    const statusConfig = {
        approved: { icon: <CheckCircle2 size={48} />, color: "#22c55e", title: "KYC Onaylandı ✅", desc: "Kimlik doğrulamanız başarıyla tamamlandı. Tüm banka hizmetlerine erişebilirsiniz." },
        pending: { icon: <Clock size={48} />, color: "#f59e0b", title: "Başvuru İnceleniyor ⏳", desc: "KYC başvurunuz inceleme sürecindedir. Bu süre genellikle 1-3 iş günü sürer." },
        rejected: { icon: <XCircle size={48} />, color: "#ef4444", title: "Başvuru Reddedildi ❌", desc: "Kimlik doğrulama başvurunuz reddedildi. Lütfen bilgilerinizi kontrol ederek tekrar başvurun." },
    };

    if (status === "approved" || status === "pending") {
        const cfg = statusConfig[status];
        return (
            <div style={{ padding: 24, maxWidth: 600, margin: "0 auto" }}>
                <div style={{
                    background: "var(--bg-card)", borderRadius: 20, padding: 48,
                    border: "1px solid var(--border-color)", textAlign: "center",
                }}>
                    <div style={{ color: cfg.color, marginBottom: 16 }}>{cfg.icon}</div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{cfg.title}</h2>
                    <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6 }}>{cfg.desc}</p>
                </div>
            </div>
        );
    }

    const steps = [
        { num: 1, label: "Kişisel Bilgiler" },
        { num: 2, label: "Kimlik Belgeleri" },
        { num: 3, label: "Onay" },
    ];

    return (
        <div style={{ padding: 24, maxWidth: 650, margin: "0 auto" }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
                <FileCheck size={28} color="#6366f1" /> Kimlik Doğrulama (KYC)
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 24 }}>
                Bankacılık hizmetlerimizden yararlanmak için kimlik doğrulama sürecini tamamlayın.
            </p>

            {/* Stepper */}
            <div style={{ display: "flex", justifyContent: "center", gap: 0, marginBottom: 32 }}>
                {steps.map((s, i) => (
                    <div key={s.num} style={{ display: "flex", alignItems: "center" }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: "50%",
                            background: step >= s.num ? "#6366f1" : "var(--bg-secondary)",
                            color: step >= s.num ? "#fff" : "var(--text-secondary)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontWeight: 700, fontSize: 14, transition: "all 0.3s",
                        }}>{s.num}</div>
                        <span style={{
                            fontSize: 12, fontWeight: 600, marginLeft: 6,
                            color: step >= s.num ? "var(--text-primary)" : "var(--text-secondary)",
                        }}>{s.label}</span>
                        {i < steps.length - 1 && (
                            <div style={{
                                width: 40, height: 2, margin: "0 8px",
                                background: step > s.num ? "#6366f1" : "var(--border-color)",
                                transition: "background 0.3s",
                            }} />
                        )}
                    </div>
                ))}
            </div>

            <div style={{
                background: "var(--bg-card)", borderRadius: 20, padding: 28,
                border: "1px solid var(--border-color)",
            }}>
                {/* Step 1 */}
                {step === 1 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <h3 style={{ fontWeight: 600, marginBottom: 4 }}>👤 Kişisel Bilgiler</h3>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <div>
                                <label style={labelStyle}>Ad *</label>
                                <input name="first_name" value={form.first_name} onChange={handleChange}
                                    placeholder="Adınız" style={inputStyle} />
                            </div>
                            <div>
                                <label style={labelStyle}>Soyad *</label>
                                <input name="last_name" value={form.last_name} onChange={handleChange}
                                    placeholder="Soyadınız" style={inputStyle} />
                            </div>
                        </div>
                        <div>
                            <label style={labelStyle}>TC Kimlik No *</label>
                            <input name="national_id" value={form.national_id} onChange={handleChange}
                                placeholder="11 haneli TC No" maxLength={11} style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Telefon *</label>
                            <input name="phone" value={form.phone} onChange={handleChange}
                                placeholder="+90 5XX XXX XXXX" style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Doğum Tarihi</label>
                            <input name="birth_date" type="date" value={form.birth_date} onChange={handleChange} style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Adres</label>
                            <textarea name="address" value={form.address} onChange={handleChange}
                                placeholder="Açık adresiniz" rows={3} style={{ ...inputStyle, resize: "vertical" }} />
                        </div>
                        <button onClick={() => {
                            if (!form.first_name || !form.last_name || !form.national_id || !form.phone) {
                                toast.error("Zorunlu alanları doldurun."); return;
                            }
                            setStep(2);
                        }} style={primaryBtn}>Devam →</button>
                    </div>
                )}

                {/* Step 2 */}
                {step === 2 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <h3 style={{ fontWeight: 600, marginBottom: 4 }}>📄 Kimlik Belgeleri</h3>
                        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                            Kimlik ön ve arka yüz fotoğraflarının URL'lerini girin. (Supabase Storage veya başka bir hizmete yükleyip URL'sini yapıştırın.)
                        </p>
                        <div>
                            <label style={labelStyle}>Kimlik Ön Yüz URL</label>
                            <input name="id_front_url" value={form.id_front_url} onChange={handleChange}
                                placeholder="https://..." style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Kimlik Arka Yüz URL</label>
                            <input name="id_back_url" value={form.id_back_url} onChange={handleChange}
                                placeholder="https://..." style={inputStyle} />
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => setStep(1)} style={{ ...secondaryBtn }}>← Geri</button>
                            <button onClick={() => setStep(3)} style={{ ...primaryBtn, flex: 1 }}>Devam →</button>
                        </div>
                    </div>
                )}

                {/* Step 3: Review */}
                {step === 3 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <h3 style={{ fontWeight: 600, marginBottom: 4 }}>✅ Bilgileri Kontrol Edin</h3>
                        <div style={{ background: "var(--bg-secondary)", borderRadius: 14, padding: 16 }}>
                            {[
                                ["Ad Soyad", `${form.first_name} ${form.last_name}`],
                                ["TC Kimlik No", form.national_id],
                                ["Telefon", form.phone],
                                ["Doğum Tarihi", form.birth_date || "-"],
                                ["Adres", form.address || "-"],
                                ["Kimlik Ön Yüz", form.id_front_url ? "✅ Yüklendi" : "❌ Yüklenmedi"],
                                ["Kimlik Arka Yüz", form.id_back_url ? "✅ Yüklendi" : "❌ Yüklenmedi"],
                            ].map(([label, val]) => (
                                <div key={label} style={{
                                    display: "flex", justifyContent: "space-between", padding: "8px 0",
                                    borderBottom: "1px solid var(--border-color)",
                                }}>
                                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{label}</span>
                                    <span style={{ fontSize: 13, fontWeight: 600 }}>{val}</span>
                                </div>
                            ))}
                        </div>

                        <div style={{
                            background: "rgba(245,158,11,0.1)", borderRadius: 12, padding: 14,
                            border: "1px solid rgba(245,158,11,0.2)", display: "flex", gap: 10, alignItems: "start",
                        }}>
                            <AlertCircle size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
                            <p style={{ fontSize: 12, color: "#f59e0b", lineHeight: 1.5 }}>
                                Başvurunuz onaylandıktan sonra bilgileriniz değiştirilemez. Lütfen tüm bilgilerin doğru olduğundan emin olun.
                            </p>
                        </div>

                        <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => setStep(2)} style={{ ...secondaryBtn }}>← Geri</button>
                            <button onClick={handleSubmit} disabled={submitting} style={{ ...primaryBtn, flex: 1 }}>
                                {submitting ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Gönderiliyor...</> : "Başvuruyu Gönder 🚀"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

const labelStyle = { fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" };
const inputStyle = { width: "100%", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14, outline: "none", boxSizing: "border-box" };
const primaryBtn = { padding: "12px 20px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 };
const secondaryBtn = { padding: "12px 20px", borderRadius: 12, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontWeight: 600, cursor: "pointer", fontSize: 14 };
