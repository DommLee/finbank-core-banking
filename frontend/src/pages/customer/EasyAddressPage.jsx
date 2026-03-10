import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import {
    BookOpen,
    PlusCircle,
    Trash2,
    Smartphone,
    Mail,
    CreditCard,
    RefreshCw
} from "lucide-react";
import { accountApi } from "../../services/api";

const ALIAS_TYPES = {
    phone: { label: "Cep Telefonu", icon: Smartphone },
    email: { label: "E-Posta", icon: Mail },
    tc_kimlik: { label: "TC Kimlik No", icon: CreditCard },
};

export default function EasyAddressPage() {
    const [addresses, setAddresses] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const [formData, setFormData] = useState({
        account_id: "",
        alias_type: "phone",
        alias_value: "",
        label: ""
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [addressesRes, accountsRes] = await Promise.all([
                accountApi.listEasyAddresses(),
                accountApi.listMine()
            ]);
            setAddresses(Array.isArray(addressesRes.data) ? addressesRes.data : []);

            const activeAccounts = Array.isArray(accountsRes.data)
                ? accountsRes.data.filter(a => a.status === "active")
                : [];
            setAccounts(activeAccounts);

            if (activeAccounts.length > 0 && !formData.account_id) {
                setFormData(prev => ({ ...prev, account_id: activeAccounts[0].id || activeAccounts[0].account_id }));
            }
        } catch (error) {
            toast.error("Kolay adres verileri yüklenemedi.");
            setAddresses([]);
            setAccounts([]);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!formData.account_id || !formData.alias_value) {
            toast.error("Lütfen tüm zorunlu alanları doldurun.");
            return;
        }

        setActionLoading(true);
        try {
            await accountApi.createEasyAddress({
                account_id: formData.account_id,
                alias_type: formData.alias_type,
                alias_value: formData.alias_value,
                label: formData.label || undefined
            });
            toast.success("Kolay adres başarıyla tanımlandı.");
            setFormData(prev => ({ ...prev, alias_value: "", label: "" }));
            await loadData();
        } catch (error) {
            let errorMsg = "Kolay adres oluşturulamadı.";
            if (error.response?.data?.detail) {
                errorMsg = typeof error.response.data.detail === "string"
                    ? error.response.data.detail
                    : JSON.stringify(error.response.data.detail);
            }
            toast.error(errorMsg);
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Bu kolay adresi silmek istediğinize emin misiniz?")) return;

        setActionLoading(true);
        try {
            await accountApi.deleteEasyAddress(id);
            toast.success("Kolay adres silindi.");
            await loadData();
        } catch (error) {
            toast.error(error.response?.data?.detail || "Silinemedi.");
        } finally {
            setActionLoading(false);
        }
    };

    const formatAliasValue = (type, value) => {
        if (!value) return "";
        if (type === "phone" && value.length === 10) {
            return `0 (${value.slice(0, 3)}) ${value.slice(3, 6)} ${value.slice(6)}`;
        }
        return value;
    };

    const getAccountDisplay = (accountId) => {
        const account = accounts.find(a => (a.id || a.account_id) === accountId);
        return account ? account.account_number : "Bilinmeyen Hesap";
    };

    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
                <div style={{ width: 48, height: 48, border: "4px solid var(--border-color)", borderTop: "4px solid #2563eb", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                <style>{"@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }"}</style>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
            <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: 30, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ background: "rgba(37,99,235,0.1)", padding: 10, borderRadius: 12, color: "#2563eb" }}>
                        <BookOpen size={24} />
                    </div>
                    Kolay Adres
                </h1>
                <p style={{ color: "var(--text-secondary)", margin: "8px 0 0", fontSize: 15, maxWidth: 600 }}>
                    IBAN ezberlemeye son! Telefon, TCKN veya E-Posta adresinizi banka hesabınıza bağlayın, para transferlerini kolaylaştırın.
                </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 24 }}>
                <div style={cardStyle}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Yeni Kolay Adres Bağla</h2>
                    <form onSubmit={handleCreate} style={{ display: "grid", gap: 16 }}>
                        <div>
                            <label style={labelStyle}>Adres Tipi</label>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                                {Object.entries(ALIAS_TYPES).map(([type, { label, icon: Icon }]) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, alias_type: type, alias_value: "" }))}
                                        style={{
                                            ...typeButtonStyle,
                                            background: formData.alias_type === type ? "rgba(37,99,235,0.1)" : "transparent",
                                            borderColor: formData.alias_type === type ? "#2563eb" : "var(--border-color)",
                                            color: formData.alias_type === type ? "#2563eb" : "var(--text-secondary)",
                                        }}
                                    >
                                        <Icon size={16} />
                                        <span>{label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label style={labelStyle}>Adres Değeri</label>
                            <input
                                className="form-input"
                                value={formData.alias_value}
                                onChange={(e) => setFormData(prev => ({ ...prev, alias_value: e.target.value }))}
                                placeholder={
                                    formData.alias_type === "phone" ? "5XX1234567" :
                                        formData.alias_type === "tc_kimlik" ? "11 Haneli TC Kimlik No" :
                                            "ornek@email.com"
                                }
                                required
                            />
                        </div>

                        <div>
                            <label style={labelStyle}>Bağlanacak Hesap</label>
                            <select
                                className="form-select"
                                value={formData.account_id}
                                onChange={(e) => setFormData(prev => ({ ...prev, account_id: e.target.value }))}
                                required
                            >
                                <option value="" disabled>Hesap Seçin</option>
                                {accounts.map(acc => (
                                    <option key={acc.id || acc.account_id} value={acc.id || acc.account_id}>
                                        {acc.account_number} (Bakiye: {acc.balance} {acc.currency})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label style={labelStyle}>Etiket / Açıklama (Opsiyonel)</label>
                            <input
                                className="form-input"
                                value={formData.label}
                                onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                                placeholder="Örn: Şahsi Numaram, Şirket Hattım"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={actionLoading || accounts.length === 0}
                            style={{ ...primaryActionStyle, marginTop: 8 }}
                        >
                            {actionLoading ? <RefreshCw size={18} style={{ animation: "spin 1s linear infinite" }} /> : <PlusCircle size={18} />}
                            Kolay Adresi Kaydet
                        </button>
                    </form>
                </div>

                <div style={cardStyle}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Tanımlı Adreslerim</h2>

                    {addresses.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-secondary)", background: "var(--bg-secondary)", borderRadius: 16 }}>
                            Henüz tanımlanmış bir kolay adresiniz bulunmuyor.
                        </div>
                    ) : (
                        <div style={{ display: "grid", gap: 12 }}>
                            {addresses.map(address => {
                                const typeConfig = ALIAS_TYPES[address.alias_type] || ALIAS_TYPES.PHONE;
                                const Icon = typeConfig.icon;
                                const addressId = address.id || address.address_id;

                                return (
                                    <div key={addressId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 16, border: "1px solid var(--border-color)", borderRadius: 16, background: "var(--bg-secondary)" }}>
                                        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                                            <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}>
                                                <Icon size={20} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: 15 }}>
                                                    {formatAliasValue(address.alias_type, address.alias_value)}
                                                </div>
                                                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                                                    {address.label || typeConfig.label} • {getAccountDisplay(address.account_id)}
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(addressId)}
                                            disabled={actionLoading}
                                            style={{ background: "transparent", border: "none", color: "#ef4444", cursor: actionLoading ? "not-allowed" : "pointer", padding: 8, opacity: actionLoading ? 0.5 : 1 }}
                                            title="Sil"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
            <style>{"@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }"}</style>
        </div>
    );
}

const cardStyle = {
    background: "var(--bg-card)",
    borderRadius: 20,
    padding: 24,
    border: "1px solid var(--border-color)",
};

const labelStyle = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-secondary)",
    marginBottom: 8,
};

const typeButtonStyle = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "16px 8px",
    borderRadius: 12,
    border: "1px solid",
    fontWeight: 600,
    fontSize: 12,
    cursor: "pointer",
    transition: "all 0.2s"
};

const primaryActionStyle = {
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    color: "#fff",
    border: "none",
    padding: "14px 24px",
    borderRadius: 14,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    transition: "opacity 0.2s"
};
