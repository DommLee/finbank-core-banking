import { useState, useEffect } from "react";
import {
    Zap, Droplets, Flame, Wifi, Phone, FileText,
    CreditCard, Clock, CheckCircle, Send, RefreshCw, Plus, XCircle
} from "lucide-react";
import { billsApi, billApi, accountApi } from "../services/api";
import toast from "react-hot-toast";

const BILL_TYPES = [
    { id: "electric", label: "Elektrik", icon: Zap, color: "#f59e0b" },
    { id: "water", label: "Su", icon: Droplets, color: "#3b82f6" },
    { id: "gas", label: "Doğalgaz", icon: Flame, color: "#ef4444" },
    { id: "internet", label: "İnternet", icon: Wifi, color: "#8b5cf6" },
    { id: "phone", label: "Telefon", icon: Phone, color: "#10b981" },
    { id: "other", label: "Diğer", icon: FileText, color: "#6b7280" },
];

export default function BillPayPage() {
    const [accounts, setAccounts] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [paying, setPaying] = useState(false);
    const [activeTab, setActiveTab] = useState("pay");
    const [selectedType, setSelectedType] = useState(null);
    const [form, setForm] = useState({
        account_id: "",
        provider: "",
        subscriber_no: "",
        amount: "",
    });

    const [autoBills, setAutoBills] = useState([]);
    const [actionLoading, setActionLoading] = useState(false);
    const [showAutoModal, setShowAutoModal] = useState(false);
    const [autoForm, setAutoForm] = useState({
        account_id: "",
        provider: "",
        subscriber_no: "",
        payment_day: 1,
        max_amount: ""
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [accRes, histRes, autoRes] = await Promise.allSettled([
                accountApi.listMine(),
                billsApi.history(),
                billApi.listAuto(),
            ]);
            setAccounts(accRes.status === "fulfilled" ? (Array.isArray(accRes.value.data) ? accRes.value.data : (accRes.value.data?.data || [])) : []);
            setHistory(histRes.status === "fulfilled" ? (Array.isArray(histRes.value.data) ? histRes.value.data : (histRes.value.data?.data || [])) : []);
            setAutoBills(autoRes.status === "fulfilled" ? (Array.isArray(autoRes.value.data?.data) ? autoRes.value.data.data : []) : []);
        } catch { }
        finally { setLoading(false); }
    };

    const handlePay = async (e) => {
        e.preventDefault();
        if (!selectedType || !form.account_id || !form.provider || !form.subscriber_no || !form.amount) {
            toast.error("Lütfen tüm alanları doldurun.");
            return;
        }
        setPaying(true);
        try {
            await billsApi.pay({
                account_id: form.account_id,
                bill_type: selectedType,
                provider: form.provider,
                subscriber_no: form.subscriber_no,
                amount: parseFloat(form.amount),
            });
            toast.success("Fatura başarıyla ödendi! ✅");
            setForm({ account_id: "", provider: "", subscriber_no: "", amount: "" });
            setSelectedType(null);
            loadData();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Ödeme başarısız.");
        } finally { setPaying(false); }
    };

    const handleCreateAuto = async (e) => {
        e.preventDefault();
        if (!selectedType || !autoForm.account_id || !autoForm.provider || !autoForm.subscriber_no || !autoForm.payment_day) {
            toast.error("Lütfen gerekli tüm alanları doldurun.");
            return;
        }
        setActionLoading(true);
        try {
            await billApi.createAuto({
                account_id: autoForm.account_id,
                bill_type: selectedType,
                provider: autoForm.provider,
                subscriber_no: autoForm.subscriber_no,
                payment_day: Number(autoForm.payment_day),
                max_amount: autoForm.max_amount ? Number(autoForm.max_amount) : null
            });
            toast.success("Otomatik ödeme talimatı oluşturuldu! ✅");
            setShowAutoModal(false);
            setAutoForm({ account_id: "", provider: "", subscriber_no: "", payment_day: 1, max_amount: "" });
            setSelectedType(null);
            loadData();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Talimat oluşturulamadı.");
        } finally { setActionLoading(false); }
    };

    const handleCancelAuto = async (id) => {
        if (!window.confirm("Bu otomatik ödeme talimatını iptal etmek istediğinize emin misiniz?")) return;
        setActionLoading(true);
        try {
            await billApi.cancelAuto(id);
            toast.success("Talimat iptal edildi.");
            loadData();
        } catch (err) {
            toast.error("İptal işlemi başarısız oldu.");
        } finally { setActionLoading(false); }
    };

    const formatCurrency = (val) =>
        new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(val || 0);

    const formatDate = (d) => {
        if (!d) return "";
        return new Date(d).toLocaleDateString("tr-TR", {
            day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
        });
    };

    if (loading) {
        return (
            <div className="page-container" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
                <div className="spinner" style={{ width: 40, height: 40 }} />
            </div>
        );
    }

    return (
        <div className="page-container" style={{ maxWidth: 900 }}>
            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>💡 Fatura Ödeme</h1>
                <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
                    Elektrik, su, doğalgaz ve daha fazla faturanızı kolayca ödeyin.
                </p>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", background: "var(--bg-secondary)", padding: 6, borderRadius: 16 }}>
                <TabBtn active={activeTab === "pay"} onClick={() => setActiveTab("pay")}>
                    💳 Fatura Öde
                </TabBtn>
                <TabBtn active={activeTab === "auto"} onClick={() => setActiveTab("auto")}>
                    🔄 Otomatik Ödemeler
                </TabBtn>
                <TabBtn active={activeTab === "history"} onClick={() => setActiveTab("history")}>
                    📜 Ödeme Geçmişi ({history.length})
                </TabBtn>
            </div>

            {/* Pay Tab */}
            {activeTab === "pay" && (
                <div className="card" style={{ padding: 24 }}>
                    {/* Bill Type Selection */}
                    <div style={{ marginBottom: 20 }}>
                        <label className="form-label">Fatura Türü</label>
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
                            gap: 10,
                        }}>
                            {BILL_TYPES.map((bt) => {
                                const Icon = bt.icon;
                                return (
                                    <button
                                        key={bt.id}
                                        onClick={() => setSelectedType(bt.id)}
                                        style={{
                                            padding: "14px 10px", borderRadius: 14, border: "none",
                                            cursor: "pointer", textAlign: "center",
                                            background: selectedType === bt.id
                                                ? `linear-gradient(135deg, ${bt.color}, ${bt.color}88)`
                                                : "var(--bg-secondary)",
                                            color: selectedType === bt.id ? "#fff" : "var(--text-secondary)",
                                            transition: "all 0.2s",
                                        }}
                                    >
                                        <Icon size={22} style={{ marginBottom: 6, display: "block", margin: "0 auto 6px" }} />
                                        <div style={{ fontSize: 12, fontWeight: 600 }}>{bt.label}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {selectedType && (
                        <form onSubmit={handlePay}>
                            <div className="form-group">
                                <label className="form-label">Hesap Seçin</label>
                                <select
                                    className="form-input"
                                    value={form.account_id}
                                    onChange={(e) => setForm({ ...form, account_id: e.target.value })}
                                    required
                                >
                                    <option value="">Hesap seçin...</option>
                                    {accounts.filter(a => a.status === "active").map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.account_number} ({a.currency})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                                <div className="form-group">
                                    <label className="form-label">Kurum / Sağlayıcı</label>
                                    <input
                                        className="form-input"
                                        placeholder="Örn: TEDAŞ, İGDAŞ..."
                                        value={form.provider}
                                        onChange={(e) => setForm({ ...form, provider: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Abone No</label>
                                    <input
                                        className="form-input"
                                        placeholder="Abone numaranız"
                                        value={form.subscriber_no}
                                        onChange={(e) => setForm({ ...form, subscriber_no: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Tutar (₺)</label>
                                <input
                                    className="form-input"
                                    type="number"
                                    step="0.01"
                                    min="1"
                                    placeholder="0.00"
                                    value={form.amount}
                                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={paying}
                                style={{ width: "100%", height: 48, fontSize: 16, fontWeight: 600, marginTop: 8 }}
                            >
                                {paying ? (
                                    <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                                ) : (
                                    <><Send size={18} /> Fatura Öde</>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            )}

            {/* History Tab */}
            {activeTab === "history" && (
                <div>
                    {history.length === 0 ? (
                        <div className="card" style={{ padding: 40, textAlign: "center" }}>
                            <Clock size={40} style={{ color: "var(--text-muted)", marginBottom: 12 }} />
                            <p style={{ color: "var(--text-muted)" }}>Henüz fatura ödemesi bulunmuyor.</p>
                        </div>
                    ) : history.map((bill, i) => {
                        const bt = BILL_TYPES.find(b => b.id === bill.bill_type) || BILL_TYPES[5];
                        const Icon = bt.icon;
                        return (
                            <div key={bill.bill_id || i} className="card" style={{
                                padding: 16, marginBottom: 10,
                                display: "flex", alignItems: "center", gap: 14,
                            }}>
                                <div style={{
                                    width: 44, height: 44, borderRadius: 12,
                                    background: `${bt.color}20`, color: bt.color,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    flexShrink: 0,
                                }}>
                                    <Icon size={20} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                                        {bill.provider} — {bt.label}
                                    </div>
                                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                        Abone: {bill.subscriber_no} · {formatDate(bill.paid_at)}
                                    </div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                                        {formatCurrency(bill.amount)}
                                    </div>
                                    <span style={{
                                        fontSize: 11, padding: "2px 8px", borderRadius: 6,
                                        background: "rgba(16,185,129,0.15)", color: "#10b981", fontWeight: 600,
                                    }}>
                                        <CheckCircle size={10} /> Ödendi
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Auto Bills Tab */}
            {activeTab === "auto" && (
                <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                        <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Otomatik Ödeme Talimatları</h3>
                        <button
                            onClick={() => setShowAutoModal(true)}
                            style={{ background: "#f59e0b", color: "#fff", border: "none", padding: "10px 16px", borderRadius: 12, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                        >
                            <Plus size={18} /> Yeni Talimat
                        </button>
                    </div>

                    {autoBills.length === 0 ? (
                        <div className="card" style={{ padding: 40, textAlign: "center" }}>
                            <RefreshCw size={40} style={{ color: "var(--text-muted)", marginBottom: 12 }} />
                            <p style={{ color: "var(--text-muted)" }}>Henüz otomatik ödeme talimatınız bulunmuyor.</p>
                        </div>
                    ) : (
                        <div style={{ display: "grid", gap: 16 }}>
                            {autoBills.map(ab => {
                                const bt = BILL_TYPES.find(b => b.id === ab.bill_type) || BILL_TYPES[5];
                                const Icon = bt.icon;
                                return (
                                    <div key={ab.auto_bill_id} className="card" style={{ padding: 20, display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 20 }}>
                                        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                                            <div style={{ width: 48, height: 48, borderRadius: 14, background: `${bt.color}20`, color: bt.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                <Icon size={24} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: 16 }}>{ab.provider}</div>
                                                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>Abone: {ab.subscriber_no}</div>
                                                <div style={{ fontSize: 12, fontWeight: 600, color: "#f59e0b", marginTop: 4 }}>
                                                    Her ayın {ab.payment_day}. günü
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                                            {ab.max_amount && (
                                                <div style={{ textAlign: "right" }}>
                                                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Maks. Limit</div>
                                                    <div style={{ fontWeight: 800 }}>{formatCurrency(ab.max_amount)}</div>
                                                </div>
                                            )}
                                            <button
                                                onClick={() => handleCancelAuto(ab.auto_bill_id)}
                                                style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "none", padding: "8px 12px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}
                                                disabled={actionLoading}
                                            >
                                                İptal Et
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Auto Bill Create Modal */}
            {showAutoModal && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 20 }}>
                    <div style={{ background: "var(--bg-card)", padding: 24, borderRadius: 24, width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Yeni Otomatik Talimat</h2>
                            <button onClick={() => { setShowAutoModal(false); setSelectedType(null); }} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}><XCircle size={24} /></button>
                        </div>

                        <div style={{ marginBottom: 20 }}>
                            <label className="form-label" style={{ marginBottom: 10 }}>Fatura Türü</label>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                                {BILL_TYPES.map((bt) => {
                                    const Icon = bt.icon;
                                    return (
                                        <button
                                            key={bt.id}
                                            onClick={() => setSelectedType(bt.id)}
                                            style={{
                                                padding: "10px", borderRadius: 12, border: "1px solid var(--border-color)",
                                                cursor: "pointer", textAlign: "center",
                                                background: selectedType === bt.id ? `${bt.color}20` : "transparent",
                                                color: selectedType === bt.id ? bt.color : "var(--text-secondary)",
                                                fontWeight: selectedType === bt.id ? 700 : 500,
                                            }}
                                        >
                                            <Icon size={20} style={{ margin: "0 auto 4px" }} />
                                            <div style={{ fontSize: 12 }}>{bt.label}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {selectedType && (
                            <form onSubmit={handleCreateAuto} style={{ display: "grid", gap: 16 }}>
                                <div>
                                    <label className="form-label">Hesap Seçin</label>
                                    <select
                                        className="form-input"
                                        value={autoForm.account_id}
                                        onChange={(e) => setAutoForm({ ...autoForm, account_id: e.target.value })}
                                        required
                                    >
                                        <option value="">Hesap seçin...</option>
                                        {accounts.filter(a => a.status === "active").map((a) => (
                                            <option key={a.id || a.account_id} value={a.id || a.account_id}>
                                                {a.account_number} ({a.balance} TL)
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                                    <div>
                                        <label className="form-label">Kurum / Sağlayıcı</label>
                                        <input
                                            className="form-input" placeholder="Örn: TEDAŞ" required
                                            value={autoForm.provider} onChange={(e) => setAutoForm({ ...autoForm, provider: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="form-label">Abone No</label>
                                        <input
                                            className="form-input" placeholder="Abone numarası" required
                                            value={autoForm.subscriber_no} onChange={(e) => setAutoForm({ ...autoForm, subscriber_no: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                                    <div>
                                        <label className="form-label">Ödeme Günü (1-31)</label>
                                        <input
                                            className="form-input" type="number" min="1" max="31" required
                                            value={autoForm.payment_day} onChange={(e) => setAutoForm({ ...autoForm, payment_day: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="form-label">Maks. Tutar (Opsiyonel)</label>
                                        <input
                                            className="form-input" type="number" step="0.01" min="1" placeholder="Limitsiz"
                                            value={autoForm.max_amount} onChange={(e) => setAutoForm({ ...autoForm, max_amount: e.target.value })}
                                            title="Bu tutarı aşan faturalar otomatik ödenmez."
                                        />
                                    </div>
                                </div>

                                <button type="submit" style={{ background: "#10b981", color: "#fff", border: "none", padding: "14px", borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 8 }} disabled={actionLoading}>
                                    {actionLoading ? <RefreshCw size={20} style={{ animation: "spin 1s linear infinite" }} /> : <><CheckCircle size={20} /> Talimatı Kaydet</>}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function TabBtn({ active, onClick, children }) {
    return (
        <button onClick={onClick} style={{
            flex: 1, padding: "12px 16px", borderRadius: 12, border: "none",
            fontWeight: active ? 800 : 600, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap",
            background: active ? "var(--bg-card)" : "transparent",
            color: active ? "var(--text-primary)" : "var(--text-secondary)",
            boxShadow: active ? "0 2px 8px rgba(0,0,0,0.05)" : "none",
            transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8
        }}>
            {children}
        </button>
    );
}
