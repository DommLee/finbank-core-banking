import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { customerApi } from "../services/api";
import {
    User, Phone, MapPin, Calendar, Shield, CreditCard,
    Save, CheckCircle, Lock, Key, AlertCircle, Loader2,
    Mail, Clock, UserCheck, Edit3,
} from "lucide-react";
import toast from "react-hot-toast";

export default function ProfilePage() {
    const { user } = useAuth();
    const [customer, setCustomer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ full_name: "", phone: "", address: "" });

    const [pwdForm, setPwdForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
    const [pwdLoading, setPwdLoading] = useState(false);

    const loadProfile = async () => {
        try {
            const res = await customerApi.getProfile();
            setCustomer(res.data);
            setForm({
                full_name: res.data.full_name || "",
                phone: res.data.phone || "",
                address: res.data.address || "",
            });
        } catch { /* */ }
        setLoading(false);
    };

    useEffect(() => { loadProfile(); }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await customerApi.updateMe(form);
            toast.success("Profil güncellendi! ✅");
            setEditing(false);
            loadProfile();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Güncelleme yapılamadı.");
        }
        setSaving(false);
    };

    const handlePwdSubmit = async (e) => {
        e.preventDefault();
        if (!pwdForm.current_password || !pwdForm.new_password || !pwdForm.confirm_password) {
            toast.error("Tüm alanları doldurun."); return;
        }
        if (pwdForm.new_password !== pwdForm.confirm_password) {
            toast.error("Yeni şifreler eşleşmiyor."); return;
        }
        if (pwdForm.new_password.length < 8) {
            toast.error("Yeni şifre en az 8 karakter olmalıdır."); return;
        }

        setPwdLoading(true);
        try {
            await customerApi.changePassword({
                current_password: pwdForm.current_password,
                new_password: pwdForm.new_password
            });
            toast.success("Şifreniz başarıyla değiştirildi! 🔒");
            setPwdForm({ current_password: "", new_password: "", confirm_password: "" });
        } catch (err) {
            toast.error(err.response?.data?.detail || "Şifre değiştirilemedi.");
        }
        setPwdLoading(false);
    };

    // Parse full_name into initials
    const getInitials = (name) => {
        if (!name) return "??";
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        return name.slice(0, 2).toUpperCase();
    };

    if (loading) return <div style={{ textAlign: "center", padding: 60 }}><Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} /></div>;

    if (!customer && !loading) {
        return (
            <div style={{ padding: 24, textAlign: "center", maxWidth: 500, margin: "0 auto" }}>
                <div style={{ background: "var(--bg-card)", borderRadius: 20, padding: 40, border: "1px solid var(--border-color)" }}>
                    <User size={48} color="#6366f1" style={{ marginBottom: 16 }} />
                    <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Profil Bulunamadı</h2>
                    <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.5 }}>Lütfen önce anasayfadan müşteri profilinizi oluşturun veya KYC sürecini tamamlayın.</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: 24, paddingBottom: 60, maxWidth: 900, margin: "0 auto" }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
                <User size={28} color="#6366f1" /> Profil ve Ayarlar
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 28 }}>
                Kişisel bilgilerinizi ve hesap güvenliğinizi yönetin.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: 20 }}>

                {/* Profile Card */}
                <div style={{ background: "var(--bg-card)", borderRadius: 20, padding: 28, border: "1px solid var(--border-color)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24 }}>
                        <div style={{
                            width: 80, height: 80, borderRadius: "50%",
                            background: "linear-gradient(135deg, #6366f1, #a855f7)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 32, fontWeight: 800, color: "#fff", flexShrink: 0,
                        }}>
                            {getInitials(customer.full_name)}
                        </div>
                        <div>
                            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{customer.full_name}</h2>
                            <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 8 }}>{user?.email}</div>
                            <div style={{
                                display: "inline-flex", alignItems: "center", gap: 6,
                                background: customer.status === "active" ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)",
                                color: customer.status === "active" ? "#22c55e" : "#f59e0b",
                                padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                            }}>
                                {customer.status === "active" ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                                {customer.status === "active" ? "DOĞRULANMIŞ HESAP" : customer.status?.toUpperCase()}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <InfoRow icon={<User size={18} />} label="Ad Soyad" value={
                            editing ? <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} style={inputStyle} placeholder="Ad Soyad" /> : (customer.full_name || "-")
                        } />
                        <InfoRow icon={<Mail size={18} />} label="E-posta" value={user?.email || "-"} />
                        <InfoRow icon={<CreditCard size={18} />} label="TC Kimlik No" value={maskTC(customer.national_id)} />
                        <InfoRow icon={<UserCheck size={18} />} label="Rol" value={
                            user?.role === "customer" ? "Müşteri" :
                                user?.role === "admin" ? "Yönetici" :
                                    user?.role === "employee" ? "Personel" :
                                        user?.role === "ceo" ? "Üst Yönetim" : user?.role
                        } />
                        <InfoRow icon={<Calendar size={18} />} label="Kayıt Tarihi" value={customer.created_at ? new Date(customer.created_at).toLocaleDateString("tr-TR", { year: "numeric", month: "long", day: "numeric" }) : "-"} />
                        <InfoRow icon={<Calendar size={18} />} label="Doğum Tarihi" value={
                            editing ? <input type="date" value={form.date_of_birth || ""} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} style={inputStyle} /> : (customer.date_of_birth ? new Date(customer.date_of_birth).toLocaleDateString("tr-TR") : "Belirtilmemiş")
                        } />

                        <InfoRow icon={<Phone size={18} />} label="Telefon" value={
                            editing ? <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={inputStyle} placeholder="+905551234567" /> : (customer.phone || "-")
                        } />
                        <InfoRow icon={<MapPin size={18} />} label="Açık Adres" value={
                            editing ? <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical" }} placeholder="Adresiniz" /> : (customer.address || "-")
                        } />

                        <InfoRow icon={<Shield size={18} />} label="KYC Durumu" value={
                            <span style={{
                                color: customer.kyc_verified ? "#22c55e" : "#f59e0b",
                                fontWeight: 600,
                            }}>
                                {customer.kyc_verified ? "✅ Doğrulandı" : "⏳ Beklemede"}
                            </span>
                        } />
                    </div>

                    <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
                        {editing ? (
                            <>
                                <button onClick={() => setEditing(false)} style={{ ...secondaryBtn, flex: 1 }}>İptal</button>
                                <button onClick={handleSave} disabled={saving} style={{ ...primaryBtn, flex: 2 }}>
                                    {saving ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <><Save size={16} /> Kaydet</>}
                                </button>
                            </>
                        ) : (
                            <button onClick={() => setEditing(true)} style={{ ...secondaryBtn, width: "100%" }}>
                                <Edit3 size={16} style={{ marginRight: 6 }} /> Bilgileri Düzenle
                            </button>
                        )}
                    </div>
                </div>

                {/* Security & Password Card */}
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div style={{ background: "var(--bg-card)", borderRadius: 20, padding: 28, border: "1px solid var(--border-color)" }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                            <Key size={20} color="#f59e0b" /> Şifre Değiştir
                        </h3>
                        <form onSubmit={handlePwdSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                            <div>
                                <label style={labelStyle}>Mevcut Şifre</label>
                                <input type="password" value={pwdForm.current_password} onChange={(e) => setPwdForm({ ...pwdForm, current_password: e.target.value })} style={inputStyle} placeholder="••••••••" />
                            </div>
                            <div>
                                <label style={labelStyle}>Yeni Şifre</label>
                                <input type="password" value={pwdForm.new_password} onChange={(e) => setPwdForm({ ...pwdForm, new_password: e.target.value })} style={inputStyle} placeholder="En az 8 karakter" />
                            </div>
                            <div>
                                <label style={labelStyle}>Yeni Şifre (Tekrar)</label>
                                <input type="password" value={pwdForm.confirm_password} onChange={(e) => setPwdForm({ ...pwdForm, confirm_password: e.target.value })} style={inputStyle} placeholder="••••••••" />
                            </div>
                            <button type="submit" disabled={pwdLoading} style={{ ...primaryBtn, marginTop: 4 }}>
                                {pwdLoading ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : "Şifreyi Güncelle"}
                            </button>
                        </form>
                    </div>

                    {/* Account Info Card */}
                    <div style={{ background: "var(--bg-card)", borderRadius: 20, padding: 20, border: "1px solid var(--border-color)" }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8, color: "#6366f1" }}>
                            <Clock size={18} /> Hesap Bilgileri
                        </h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "8px 12px", background: "var(--bg-secondary)", borderRadius: 10 }}>
                                <span style={{ color: "var(--text-secondary)" }}>Hesap Türü</span>
                                <span style={{ fontWeight: 600 }}>{user?.role === "customer" ? "Bireysel" : "Kurumsal"}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "8px 12px", background: "var(--bg-secondary)", borderRadius: 10 }}>
                                <span style={{ color: "var(--text-secondary)" }}>Hesap Durumu</span>
                                <span style={{ fontWeight: 600, color: customer.status === "active" ? "#22c55e" : "#f59e0b" }}>
                                    {customer.status === "active" ? "Aktif" : "Beklemede"}
                                </span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "8px 12px", background: "var(--bg-secondary)", borderRadius: 10 }}>
                                <span style={{ color: "var(--text-secondary)" }}>Müşteri ID</span>
                                <span style={{ fontWeight: 600, fontFamily: "monospace", fontSize: 11 }}>{customer.id?.slice(0, 8)}...</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ background: "rgba(99,102,241,0.06)", borderRadius: 20, padding: 20, border: "1px solid rgba(99,102,241,0.15)" }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 8, color: "#6366f1" }}>
                            <Shield size={18} /> Güvenlik İpuçları
                        </h3>
                        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                            <li>Şifrenizi kimseyle paylaşmayın, banka personeli dahil.</li>
                            <li>Başka sitelerde kullandığınız şifreleri burada kullanmayın.</li>
                            <li>İki faktörlü doğrulamayı (2FA) Güvenlik Ayarları sayfasından açabilirsiniz.</li>
                        </ul>
                    </div>
                </div>
            </div>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

function InfoRow({ icon, label, value }) {
    return (
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "var(--bg-secondary)", padding: "12px 16px", borderRadius: 12 }}>
            <div style={{ color: "var(--text-secondary)", marginTop: 2 }}>{icon}</div>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{value}</div>
            </div>
        </div>
    );
}

function maskTC(tc) {
    if (!tc || tc.length !== 11) return "Belirtilmemiş";
    return tc.slice(0, 3) + "•••••" + tc.slice(-3);
}

const labelStyle = { fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" };
const inputStyle = { width: "100%", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14, outline: "none", boxSizing: "border-box" };
const primaryBtn = { padding: "12px 20px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 };
const secondaryBtn = { padding: "12px 20px", borderRadius: 12, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontWeight: 600, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" };
