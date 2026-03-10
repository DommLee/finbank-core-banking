import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../services/api";
import toast from "react-hot-toast";
import {
    Lock, Mail, UserPlus, LogIn, Shield, Zap, Globe,
    User, Phone, CreditCard, CheckCircle, AlertCircle,
    Eye, EyeOff, ArrowRight, ArrowLeft, FileCheck, ChevronRight,
} from "lucide-react";

// ── TC Kimlik Numarası Doğrulama Algoritması ──
function validateTC(tc) {
    if (!tc || tc.length !== 11) return { valid: false, error: "TC Kimlik numarası 11 haneli olmalıdır." };
    if (!/^\d{11}$/.test(tc)) return { valid: false, error: "TC Kimlik numarası sadece rakamlardan oluşmalıdır." };
    if (tc[0] === "0") return { valid: false, error: "TC Kimlik numarası 0 ile başlayamaz." };

    const d = tc.split("").map(Number);
    const oddSum = d[0] + d[2] + d[4] + d[6] + d[8];
    const evenSum = d[1] + d[3] + d[5] + d[7];
    const check10 = ((oddSum * 7) - evenSum) % 10;
    const digit10 = check10 < 0 ? check10 + 10 : check10;
    if (digit10 !== d[9]) {
        return { valid: false, error: "TC Kimlik numarası geçersiz (10. hane kontrolü başarısız)." };
    }
    const sum10 = d.slice(0, 10).reduce((a, b) => a + b, 0);
    if (sum10 % 10 !== d[10]) {
        return { valid: false, error: "TC Kimlik numarası geçersiz (11. hane kontrolü başarısız)." };
    }
    return { valid: true, error: null };
}

// ── Şifre Güçlülük Analizi ──
function analyzePassword(password) {
    const checks = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /\d/.test(password),
        special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    };
    const score = Object.values(checks).filter(Boolean).length;
    let level = "Çok Zayıf";
    let color = "#ef4444";
    if (score >= 5) { level = "Çok Güçlü"; color = "#22c55e"; }
    else if (score >= 4) { level = "Güçlü"; color = "#10b981"; }
    else if (score >= 3) { level = "Orta"; color = "#f59e0b"; }
    else if (score >= 2) { level = "Zayıf"; color = "#f97316"; }
    return { checks, score, level, color, percent: (score / 5) * 100 };
}

// ── Telefon Formatı ──
function formatPhone(value) {
    const digits = value.replace(/\D/g, "");
    if (digits.startsWith("90") && digits.length <= 12) {
        const parts = digits.slice(2);
        let formatted = "+90";
        if (parts.length > 0) formatted += " " + parts.slice(0, 3);
        if (parts.length > 3) formatted += " " + parts.slice(3, 6);
        if (parts.length > 6) formatted += " " + parts.slice(6, 8);
        if (parts.length > 8) formatted += " " + parts.slice(8, 10);
        return formatted;
    }
    return value;
}

// ── Adım Başlıkları ──
const STEPS = [
    { title: "Kişisel Bilgiler", icon: User, desc: "Temel kimlik bilgileriniz" },
    { title: "İletişim", icon: Phone, desc: "Telefon ve adres bilgileri" },
    { title: "Güvenlik", icon: Shield, desc: "Şifre ve hesap güvenliği" },
    { title: "Onay", icon: FileCheck, desc: "Bilgilerinizi kontrol edin" },
];

export default function LoginPage() {
    const { login } = useAuth();
    const [isRegister, setIsRegister] = useState(false);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(0);
    const [showPassword, setShowPassword] = useState(false);

    const [form, setForm] = useState({
        email: "", password: "",
        full_name: "", phone: "", national_id: "",
        date_of_birth: "", address: "",
        kvkk: false, terms: false,
    });

    const [errors, setErrors] = useState({});
    const [tcResult, setTcResult] = useState(null);
    const [pwdAnalysis, setPwdAnalysis] = useState(null);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const newVal = type === "checkbox" ? checked : value;
        setForm(prev => ({ ...prev, [name]: newVal }));
        setErrors(prev => ({ ...prev, [name]: null }));

        if (name === "national_id") {
            if (value.length === 11) setTcResult(validateTC(value));
            else setTcResult(null);
        }
        if (name === "password") {
            setPwdAnalysis(value.length > 0 ? analyzePassword(value) : null);
        }
        if (name === "phone") {
            setForm(prev => ({ ...prev, phone: formatPhone(value) }));
        }
    };

    // ── Adım Validasyonları ──
    const validateStep = (s) => {
        const errs = {};
        if (s === 0) {
            if (!form.full_name || form.full_name.trim().length < 2) errs.full_name = "Ad Soyad en az 2 karakter olmalıdır.";
            if (!form.full_name.trim().includes(" ")) errs.full_name = "Lütfen ad ve soyadınızı ayrı girin.";
            if (!form.national_id) errs.national_id = "TC Kimlik numarası zorunludur.";
            else {
                const tc = validateTC(form.national_id);
                if (!tc.valid) errs.national_id = tc.error;
            }
            if (!form.date_of_birth) errs.date_of_birth = "Doğum tarihi zorunludur.";
            else {
                const age = Math.floor((Date.now() - new Date(form.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
                if (age < 18) errs.date_of_birth = "18 yaşından küçükler hesap açamaz.";
                if (age > 120) errs.date_of_birth = "Geçersiz doğum tarihi.";
            }
        } else if (s === 1) {
            if (!form.email) errs.email = "E-posta adresi zorunludur.";
            else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Geçerli bir e-posta adresi girin.";
            if (!form.phone) errs.phone = "Telefon numarası zorunludur.";
            else {
                const digits = form.phone.replace(/\D/g, "");
                if (digits.length < 10 || digits.length > 12) errs.phone = "Geçerli bir telefon numarası girin.";
            }
        } else if (s === 2) {
            if (!form.password) errs.password = "Şifre zorunludur.";
            else {
                const pwd = analyzePassword(form.password);
                if (pwd.score < 3) errs.password = "Şifre en az 'Orta' güçlükte olmalıdır.";
            }
        } else if (s === 3) {
            if (!form.kvkk) errs.kvkk = "KVKK aydınlatma metnini kabul etmelisiniz.";
            if (!form.terms) errs.terms = "Kullanım koşullarını kabul etmelisiniz.";
        }
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const nextStep = () => {
        if (validateStep(step)) setStep(step + 1);
    };
    const prevStep = () => setStep(Math.max(0, step - 1));

    // ── Kayıt ──
    const handleRegister = async () => {
        if (!validateStep(3)) return;
        setLoading(true);
        try {
            const phoneDigits = "+" + form.phone.replace(/\D/g, "");
            await authApi.register({
                email: form.email,
                password: form.password,
                full_name: form.full_name.trim(),
                phone: phoneDigits,
                national_id: form.national_id,
            });
            toast.success("Hesabınız oluşturuldu! Giriş yapılıyor...");
            try {
                const res = await authApi.login({ email: form.email, password: form.password });
                login(res.data.access_token, { email: res.data.email, role: res.data.role });
                toast.success("Hoş geldiniz! 🎉");
            } catch {
                toast.success("Hesap oluşturuldu! Lütfen giriş yapın.");
                setIsRegister(false);
                setStep(0);
            }
        } catch (err) {
            toast.error(err.response?.data?.detail || "Kayıt sırasında bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    // ── Giriş ──
    const handleLogin = async (e) => {
        e.preventDefault();
        if (!form.email || !form.password) {
            toast.error("E-posta ve şifre gereklidir.");
            return;
        }
        setLoading(true);
        try {
            const res = await authApi.login({ email: form.email, password: form.password });
            login(res.data.access_token, { email: res.data.email, role: res.data.role });
            toast.success("Giriş başarılı!");
        } catch (err) {
            toast.error(err.response?.data?.detail || "Giriş başarısız. E-posta veya şifre hatalı.");
        } finally {
            setLoading(false);
        }
    };

    // ── Kayıt Multistep UI ──
    if (isRegister) {
        return (
            <div className="login-page">
                <div className="login-branding">
                    <div className="login-branding-content">
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 40 }}>
                            <div style={{
                                width: 48, height: 48, borderRadius: 14,
                                background: "linear-gradient(135deg, var(--accent), #818cf8)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontWeight: 700, fontSize: 18, color: "#fff",
                            }}>FB</div>
                            <span style={{ fontSize: 22, fontWeight: 700 }}>FinBank</span>
                        </div>
                        <h1 style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.2, marginBottom: 16 }}>
                            Güvenli Hesap<br />Oluşturma
                        </h1>
                        <p style={{ color: "var(--text-secondary)", fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
                            Bankacılık düzeyinde güvenlik ile hesabınızı adım adım oluşturun. Bilgileriniz 256-bit şifreleme ile korunur.
                        </p>

                        {/* Adım Listesi (sol panel) */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {STEPS.map((s, i) => (
                                <div key={i} style={{
                                    display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                                    borderRadius: 14, transition: "all 0.3s",
                                    background: i === step ? "rgba(99,102,241,0.12)" : "transparent",
                                }}>
                                    <div style={{
                                        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        background: i < step ? "#22c55e" : i === step ? "var(--accent)" : "rgba(255,255,255,0.08)",
                                        color: i <= step ? "#fff" : "var(--text-muted)",
                                        fontWeight: 700, fontSize: 14, transition: "all 0.3s",
                                    }}>
                                        {i < step ? <CheckCircle size={20} /> : <s.icon size={20} />}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: i === step ? 700 : 500, color: i <= step ? "var(--text-primary)" : "var(--text-muted)" }}>{s.title}</div>
                                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="login-form-side">
                    <div className="auth-card" style={{ maxWidth: 460 }}>
                        {/* Progress Bar */}
                        <div style={{ marginBottom: 24 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>
                                    Adım {step + 1} / {STEPS.length}
                                </span>
                                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                    {STEPS[step].title}
                                </span>
                            </div>
                            <div style={{ width: "100%", height: 6, borderRadius: 99, background: "var(--bg-secondary)", overflow: "hidden" }}>
                                <div style={{
                                    width: `${((step + 1) / STEPS.length) * 100}%`,
                                    height: "100%", borderRadius: 99, transition: "width 0.4s ease",
                                    background: "linear-gradient(90deg, var(--accent), #a855f7)",
                                }} />
                            </div>
                        </div>

                        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{STEPS[step].title}</h2>
                        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>{STEPS[step].desc}</p>

                        {/* ── ADIM 1: Kişisel Bilgiler ── */}
                        {step === 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                <FormField label="Ad Soyad" error={errors.full_name} hint="Nüfus cüzdanınızdaki gibi yazın">
                                    <div style={{ position: "relative" }}>
                                        <User size={16} style={iconStyle} />
                                        <input name="full_name" value={form.full_name} onChange={handleChange}
                                            className="form-input" style={{ paddingLeft: 38 }}
                                            placeholder="Örn: Ahmet Yılmaz" required aria-label="Ad Soyad" />
                                    </div>
                                </FormField>

                                <FormField label="TC Kimlik Numarası" error={errors.national_id}
                                    hint="11 haneli TC Kimlik numaranız matematiksel olarak doğrulanır"
                                    success={tcResult?.valid ? "✅ TC Kimlik numarası geçerli" : null}>
                                    <div style={{ position: "relative" }}>
                                        <CreditCard size={16} style={iconStyle} />
                                        <input name="national_id" value={form.national_id} onChange={handleChange}
                                            className="form-input" style={{ paddingLeft: 38 }}
                                            placeholder="12345678901" maxLength={11}
                                            inputMode="numeric" required aria-label="TC Kimlik Numarası" />
                                    </div>
                                </FormField>

                                <FormField label="Doğum Tarihi" error={errors.date_of_birth} hint="Hesap açmak için 18 yaşından büyük olmalısınız">
                                    <input name="date_of_birth" type="date" value={form.date_of_birth}
                                        onChange={handleChange} className="form-input"
                                        max={new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
                                        required aria-label="Doğum Tarihi" />
                                </FormField>
                            </div>
                        )}

                        {/* ── ADIM 2: İletişim ── */}
                        {step === 1 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                <FormField label="E-posta Adresi" error={errors.email} hint="Doğrulama ve bildirimler için kullanılacaktır">
                                    <div style={{ position: "relative" }}>
                                        <Mail size={16} style={iconStyle} />
                                        <input name="email" type="email" value={form.email} onChange={handleChange}
                                            className="form-input" style={{ paddingLeft: 38 }}
                                            placeholder="ornek@email.com" required aria-label="E-posta adresi" />
                                    </div>
                                </FormField>

                                <FormField label="Telefon Numarası" error={errors.phone} hint="Türkiye cep telefon numaranız">
                                    <div style={{ position: "relative" }}>
                                        <Phone size={16} style={iconStyle} />
                                        <input name="phone" type="tel" value={form.phone} onChange={handleChange}
                                            className="form-input" style={{ paddingLeft: 38 }}
                                            placeholder="+90 555 123 45 67" required aria-label="Telefon" />
                                    </div>
                                </FormField>

                                <FormField label="Adres (Opsiyonel)" hint="İleride KYC doğrulaması için gerekebilir">
                                    <textarea name="address" value={form.address} onChange={handleChange}
                                        className="form-input" rows={2} placeholder="İl, İlçe, Mahalle..."
                                        style={{ resize: "vertical" }} aria-label="Adres" />
                                </FormField>
                            </div>
                        )}

                        {/* ── ADIM 3: Güvenlik ── */}
                        {step === 2 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                <FormField label="Şifre" error={errors.password} hint="Hesabınızı koruyacak güçlü bir şifre belirleyin">
                                    <div style={{ position: "relative" }}>
                                        <Lock size={16} style={iconStyle} />
                                        <input name="password" type={showPassword ? "text" : "password"}
                                            value={form.password} onChange={handleChange}
                                            className="form-input" style={{ paddingLeft: 38, paddingRight: 42 }}
                                            placeholder="Güçlü bir şifre belirleyin" required aria-label="Şifre" />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)}
                                            style={{
                                                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                                                background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4
                                            }}
                                            aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}>
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </FormField>

                                {/* Şifre Güçlülük Göstergesi */}
                                {pwdAnalysis && (
                                    <div style={{ background: "var(--bg-secondary)", borderRadius: 14, padding: 16 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                                            <span style={{ fontSize: 12, fontWeight: 600 }}>Şifre Güçlüğü</span>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: pwdAnalysis.color }}>{pwdAnalysis.level}</span>
                                        </div>
                                        <div style={{ width: "100%", height: 5, borderRadius: 99, background: "rgba(255,255,255,0.1)", marginBottom: 14 }}>
                                            <div style={{
                                                width: `${pwdAnalysis.percent}%`, height: "100%", borderRadius: 99,
                                                background: pwdAnalysis.color, transition: "all 0.3s",
                                            }} />
                                        </div>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                                            <PwdCheck ok={pwdAnalysis.checks.length} text="En az 8 karakter" />
                                            <PwdCheck ok={pwdAnalysis.checks.uppercase} text="Büyük harf (A-Z)" />
                                            <PwdCheck ok={pwdAnalysis.checks.lowercase} text="Küçük harf (a-z)" />
                                            <PwdCheck ok={pwdAnalysis.checks.number} text="Rakam (0-9)" />
                                            <PwdCheck ok={pwdAnalysis.checks.special} text="Özel karakter (!@#)" />
                                        </div>
                                    </div>
                                )}

                                <div style={{ background: "rgba(245,158,11,0.08)", borderRadius: 14, padding: 14, border: "1px solid rgba(245,158,11,0.2)" }}>
                                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                        <Shield size={16} style={{ color: "#f59e0b", flexShrink: 0, marginTop: 2 }} />
                                        <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                                            <strong style={{ color: "#f59e0b" }}>Güvenlik Uyarısı:</strong> Şifrenizi kimseyle paylaşmayın. FinBank personeli sizden asla şifrenizi istemez.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── ADIM 4: Onay ── */}
                        {step === 3 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                {/* Bilgi Özeti */}
                                <div style={{ background: "var(--bg-secondary)", borderRadius: 14, padding: 16 }}>
                                    <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: "var(--accent)" }}>Bilgilerinizi Kontrol Edin</h4>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        <SummaryRow label="Ad Soyad" value={form.full_name} />
                                        <SummaryRow label="TC Kimlik" value={form.national_id.slice(0, 3) + "•••••" + form.national_id.slice(-3)} />
                                        <SummaryRow label="Doğum Tarihi" value={form.date_of_birth ? new Date(form.date_of_birth).toLocaleDateString("tr-TR") : "-"} />
                                        <SummaryRow label="E-posta" value={form.email} />
                                        <SummaryRow label="Telefon" value={form.phone} />
                                        {form.address && <SummaryRow label="Adres" value={form.address} />}
                                    </div>
                                </div>

                                {/* KVKK */}
                                <label style={{
                                    display: "flex", gap: 12, padding: 14, borderRadius: 14, cursor: "pointer",
                                    background: form.kvkk ? "rgba(34,197,94,0.06)" : "var(--bg-secondary)",
                                    border: errors.kvkk ? "1px solid #ef4444" : "1px solid var(--border-color)",
                                    transition: "all 0.2s",
                                }}>
                                    <input type="checkbox" name="kvkk" checked={form.kvkk} onChange={handleChange}
                                        style={{ width: 20, height: 20, accentColor: "var(--accent)", flexShrink: 0, marginTop: 2 }} />
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                                            KVKK Aydınlatma Metni
                                        </div>
                                        <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
                                            6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında kişisel verilerimin işlenmesine ilişkin
                                            <span style={{ color: "var(--accent)", fontWeight: 600 }}> aydınlatma metnini </span>
                                            okudum ve anladım.
                                        </div>
                                    </div>
                                </label>
                                {errors.kvkk && <span style={{ fontSize: 11, color: "#ef4444", marginTop: -12 }}>{errors.kvkk}</span>}

                                {/* Kullanım Koşulları */}
                                <label style={{
                                    display: "flex", gap: 12, padding: 14, borderRadius: 14, cursor: "pointer",
                                    background: form.terms ? "rgba(34,197,94,0.06)" : "var(--bg-secondary)",
                                    border: errors.terms ? "1px solid #ef4444" : "1px solid var(--border-color)",
                                    transition: "all 0.2s",
                                }}>
                                    <input type="checkbox" name="terms" checked={form.terms} onChange={handleChange}
                                        style={{ width: 20, height: 20, accentColor: "var(--accent)", flexShrink: 0, marginTop: 2 }} />
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                                            Kullanım Koşulları ve Gizlilik Politikası
                                        </div>
                                        <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
                                            FinBank
                                            <span style={{ color: "var(--accent)", fontWeight: 600 }}> Kullanım Koşulları</span>'nı ve
                                            <span style={{ color: "var(--accent)", fontWeight: 600 }}> Gizlilik Politikası</span>'nı okudum, kabul ediyorum.
                                        </div>
                                    </div>
                                </label>
                                {errors.terms && <span style={{ fontSize: 11, color: "#ef4444", marginTop: -12 }}>{errors.terms}</span>}

                                <div style={{ background: "rgba(99,102,241,0.08)", borderRadius: 14, padding: 14, border: "1px solid rgba(99,102,241,0.2)" }}>
                                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                        <Lock size={16} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }} />
                                        <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                                            Verileriniz <strong>256-bit SSL/TLS</strong> şifreleme ile korunur.
                                            Supabase Auth altyapısı ile endüstri standardı güvenlik uygulanır.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Navigasyon Butonları ── */}
                        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                            {step > 0 && (
                                <button type="button" onClick={prevStep}
                                    style={{
                                        flex: "0 0 auto", padding: "12px 20px", borderRadius: 12,
                                        border: "1px solid var(--border-color)", background: "var(--bg-secondary)",
                                        color: "var(--text-primary)", fontWeight: 600, cursor: "pointer",
                                        fontSize: 14, display: "flex", alignItems: "center", gap: 6,
                                    }}>
                                    <ArrowLeft size={16} /> Geri
                                </button>
                            )}
                            {step < 3 ? (
                                <button type="button" onClick={nextStep}
                                    className="btn btn-primary"
                                    style={{ flex: 1, height: 48, fontSize: 15, fontWeight: 600 }}>
                                    Devam Et <ArrowRight size={16} />
                                </button>
                            ) : (
                                <button type="button" onClick={handleRegister} disabled={loading}
                                    className="btn btn-primary"
                                    style={{ flex: 1, height: 48, fontSize: 15, fontWeight: 600 }}>
                                    {loading ? (
                                        <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                                    ) : (
                                        <>
                                            <UserPlus size={16} /> Hesabımı Oluştur
                                        </>
                                    )}
                                </button>
                            )}
                        </div>

                        <div className="auth-toggle" style={{ marginTop: 16 }}>
                            Zaten hesabınız var mı?{" "}
                            <a onClick={() => { setIsRegister(false); setStep(0); setErrors({}); }} style={{ cursor: "pointer" }}>
                                Giriş Yap
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── Giriş Ekranı ──
    return (
        <div className="login-page">
            <div className="login-branding">
                <div className="login-branding-content">
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 40 }}>
                        <div style={{
                            width: 48, height: 48, borderRadius: 14,
                            background: "linear-gradient(135deg, var(--accent), #818cf8)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontWeight: 700, fontSize: 18, color: "#fff",
                        }}>FB</div>
                        <span style={{ fontSize: 22, fontWeight: 700 }}>FinBank</span>
                    </div>

                    <h1 style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.2, marginBottom: 16 }}>
                        Finansal özgürlüğünüz<br />bir tık uzağınızda.
                    </h1>
                    <p style={{ color: "var(--text-secondary)", fontSize: 16, lineHeight: 1.6, marginBottom: 40 }}>
                        Modern bankacılığı deneyimleyin. Hızlı transfer, güvenli hesap yönetimi ve 7/24 finansal kontrol.
                    </p>

                    <div className="login-features">
                        <FeatureItem icon={<Shield size={18} />} title="Güvenli" desc="256-bit şifreleme ile korunur" />
                        <FeatureItem icon={<Zap size={18} />} title="Hızlı" desc="Anlık transfer ve işlemler" />
                        <FeatureItem icon={<Globe size={18} />} title="Erişilebilir" desc="Her cihazdan, her yerden" />
                    </div>
                </div>
            </div>

            <div className="login-form-side">
                <div className="auth-card">
                    <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Hoş Geldiniz</h2>
                    <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24 }}>
                        Hesabınıza giriş yapın.
                    </p>

                    <form onSubmit={handleLogin}>
                        <div className="form-group">
                            <label className="form-label" htmlFor="login-email">E-posta Adresi</label>
                            <div style={{ position: "relative" }}>
                                <Mail size={16} style={iconStyle} />
                                <input id="login-email" name="email" type="email" className="form-input"
                                    style={{ paddingLeft: 38 }} placeholder="ornek@email.com"
                                    value={form.email} onChange={handleChange} required aria-label="E-posta adresi" />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="login-password">Şifre</label>
                            <div style={{ position: "relative" }}>
                                <Lock size={16} style={iconStyle} />
                                <input id="login-password" name="password" type={showPassword ? "text" : "password"}
                                    className="form-input" style={{ paddingLeft: 38, paddingRight: 42 }}
                                    placeholder="Şifrenizi girin"
                                    value={form.password} onChange={handleChange} required aria-label="Şifre" />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                                        background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4
                                    }}
                                    aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}>
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary" disabled={loading}
                            style={{ width: "100%", marginTop: 8, height: 48, fontSize: 15 }}>
                            {loading ? (
                                <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                            ) : (
                                <><LogIn size={16} /> Giriş Yap</>
                            )}
                        </button>
                    </form>

                    <div className="auth-toggle">
                        Hesabınız yok mu?{" "}
                        <a onClick={() => { setIsRegister(true); setStep(0); setErrors({}); }} style={{ cursor: "pointer" }}>
                            Kayıt Ol
                        </a>
                    </div>

                    <div style={{
                        marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border-color)",
                        fontSize: 11, color: "var(--text-muted)", textAlign: "center",
                    }}>
                        Giriş yaparak <span style={{ color: "var(--accent)" }}>Kullanım Koşullarını</span> ve{" "}
                        <span style={{ color: "var(--accent)" }}>Gizlilik Politikasını</span> kabul etmiş olursunuz.
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Yardımcı Bileşenler ──

function FormField({ label, error, hint, success, children }) {
    return (
        <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6, display: "block" }}>
                {label}
            </label>
            {children}
            {hint && !error && !success && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{hint}</div>
            )}
            {success && (
                <div style={{ fontSize: 11, color: "#22c55e", marginTop: 4, fontWeight: 600 }}>{success}</div>
            )}
            {error && (
                <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                    <AlertCircle size={12} /> {error}
                </div>
            )}
        </div>
    );
}

function PwdCheck({ ok, text }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: ok ? "#22c55e" : "var(--text-muted)" }}>
            {ok ? <CheckCircle size={12} /> : <div style={{ width: 12, height: 12, borderRadius: "50%", border: "1.5px solid var(--text-muted)" }} />}
            {text}
        </div>
    );
}

function SummaryRow({ label, value }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-color)", fontSize: 13 }}>
            <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>{label}</span>
            <span style={{ fontWeight: 600, textAlign: "right", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{value}</span>
        </div>
    );
}

function FeatureItem({ icon, title, desc }) {
    return (
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: "rgba(99, 102, 241, 0.1)", color: "var(--accent)",
                display: "flex", alignItems: "center", justifyContent: "center",
            }}>
                {icon}
            </div>
            <div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{title}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{desc}</div>
            </div>
        </div>
    );
}

const iconStyle = {
    position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
    color: "var(--text-muted)", pointerEvents: "none",
};
