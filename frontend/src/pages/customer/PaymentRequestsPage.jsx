import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { accountApi, paymentRequestsApi } from "../../services/api";
import {
    ArrowDownLeft,
    ArrowUpRight,
    CheckCircle,
    XCircle,
    Clock,
    Plus,
    Ban,
    RefreshCw
} from "lucide-react";

export default function PaymentRequestsPage() {
    const { user } = useAuth();
    const [requests, setRequests] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // Tab state: "incoming" | "outgoing"
    const [activeTab, setActiveTab] = useState("incoming");

    // Create new request state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState({ target_alias: "", amount: "", description: "" });

    // Approve modal state
    const [approveModal, setApproveModal] = useState({ show: false, request: null, account_id: "" });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [reqRes, accRes] = await Promise.all([
                paymentRequestsApi.list(),
                accountApi.listMine()
            ]);
            setRequests(Array.isArray(reqRes.data) ? reqRes.data : reqRes.data?.data || []);

            const activeAccounts = Array.isArray(accRes.data)
                ? accRes.data.filter(a => a.status === "active")
                : accRes.data?.data?.filter(a => a.status === "active") || [];

            setAccounts(activeAccounts);
        } catch (error) {
            toast.error("Ödeme istekleri yüklenemedi.");
            setRequests([]);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateRequest = async (e) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            await paymentRequestsApi.create({
                target_alias: createForm.target_alias,
                amount: Number(createForm.amount),
                description: createForm.description || "Ödeme İsteği"
            });
            toast.success("Ödeme isteği gönderildi.");
            setShowCreateModal(false);
            setCreateForm({ target_alias: "", amount: "", description: "" });
            await loadData();
        } catch (error) {
            toast.error(error.response?.data?.detail || "Ödeme isteği gönderilemedi.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleApprove = async (e) => {
        e.preventDefault();
        if (!approveModal.account_id) {
            toast.error("Lütfen ödeme yapılacak hesabı seçin.");
            return;
        }
        setActionLoading(true);
        try {
            await paymentRequestsApi.approve(approveModal.request.request_id, {
                account_id: approveModal.account_id
            });
            toast.success("Ödeme başarıyla gerçekleştirildi.");
            setApproveModal({ show: false, request: null, account_id: "" });
            await loadData();
        } catch (error) {
            toast.error(error.response?.data?.detail || "Ödeme onaylanamadı.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async (id) => {
        if (!window.confirm("Bu ödeme isteğini reddetmek istediğinize emin misiniz?")) return;
        setActionLoading(true);
        try {
            await paymentRequestsApi.reject(id);
            toast.success("Ödeme isteği reddedildi.");
            await loadData();
        } catch (error) {
            toast.error(error.response?.data?.detail || "İşlem başarısız.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleCancel = async (id) => {
        if (!window.confirm("Bu ödeme isteğini iptal etmek istediğinize emin misiniz?")) return;
        setActionLoading(true);
        try {
            await paymentRequestsApi.cancel(id);
            toast.success("Ödeme isteği iptal edildi.");
            await loadData();
        } catch (error) {
            toast.error(error.response?.data?.detail || "İşlem başarısız.");
        } finally {
            setActionLoading(false);
        }
    };

    const formatMoney = (amount) => {
        return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(amount);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString("tr-TR", {
            day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
        });
    };

    // Filter requests
    const incomingRequests = requests.filter(r => r.target_user_id === user?.user_id);
    const outgoingRequests = requests.filter(r => r.requester_user_id === user?.user_id);
    const displayedRequests = activeTab === "incoming" ? incomingRequests : outgoingRequests;

    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
                <div style={{ width: 48, height: 48, border: "4px solid var(--border-color)", borderTop: "4px solid #f59e0b", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                <style>{"@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }"}</style>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
                <div>
                    <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-1px", marginBottom: 8 }}>Ödeme İsteği</h1>
                    <p style={{ color: "var(--text-secondary)", fontSize: 15, margin: 0 }}>
                        Arkadaşlarınızdan veya müşterilerinizden kolayca ödeme isteyin.
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    style={primaryButtonStyle}
                >
                    <Plus size={18} /> Yeni İstek
                </button>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 8, background: "var(--bg-secondary)", padding: 6, borderRadius: 16, marginBottom: 24 }}>
                <button
                    onClick={() => setActiveTab("incoming")}
                    style={tabStyle(activeTab === "incoming")}
                >
                    <ArrowDownLeft size={18} />
                    Gelen İstekler
                    {incomingRequests.filter(r => r.status === "pending").length > 0 && (
                        <span style={{ background: "#ef4444", color: "white", padding: "2px 8px", borderRadius: 99, fontSize: 12, fontWeight: 700, marginLeft: 8 }}>
                            {incomingRequests.filter(r => r.status === "pending").length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab("outgoing")}
                    style={tabStyle(activeTab === "outgoing")}
                >
                    <ArrowUpRight size={18} />
                    Giden İstekler
                </button>
            </div>

            {/* List */}
            <div style={{ display: "grid", gap: 16 }}>
                {displayedRequests.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "48px 24px", background: "var(--bg-secondary)", borderRadius: 20 }}>
                        <div style={{ width: 64, height: 64, background: "var(--bg-card)", borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                            {activeTab === "incoming" ? <ArrowDownLeft size={28} color="var(--text-secondary)" /> : <ArrowUpRight size={28} color="var(--text-secondary)" />}
                        </div>
                        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px 0" }}>
                            {activeTab === "incoming" ? "Gelen İstek Yok" : "Giden İstek Yok"}
                        </h3>
                        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                            Bu kategoride herhangi bir ödeme isteğiniz bulunmuyor.
                        </p>
                    </div>
                ) : (
                    displayedRequests.map(req => (
                        <div key={req.request_id} style={{ background: "var(--bg-card)", borderRadius: 20, padding: 20, border: "1px solid var(--border-color)", display: "flex", flexWrap: "wrap", gap: 20, justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                                <div style={{
                                    width: 48, height: 48, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center",
                                    background: req.status === "pending" ? "rgba(245,158,11,0.1)" : req.status === "paid" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                                    color: req.status === "pending" ? "#f59e0b" : req.status === "paid" ? "#22c55e" : "#ef4444"
                                }}>
                                    {req.status === "pending" ? <Clock size={24} /> : req.status === "paid" ? <CheckCircle size={24} /> : <XCircle size={24} />}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
                                        {activeTab === "incoming" ? req.requester_name : req.target_name}
                                    </div>
                                    <div style={{ color: "var(--text-secondary)", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                                        {formatDate(req.created_at)}
                                        <span style={{ opacity: 0.5 }}>•</span>
                                        <span>{req.description}</span>
                                    </div>
                                    <div style={{
                                        marginTop: 8, fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 6, display: "inline-block",
                                        background: req.status === "pending" ? "rgba(245,158,11,0.1)" : req.status === "paid" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                                        color: req.status === "pending" ? "#f59e0b" : req.status === "paid" ? "#22c55e" : "#ef4444"
                                    }}>
                                        {req.status === "pending" ? "Bekliyor" : req.status === "paid" ? "Ödendi" : req.status === "cancelled" ? "İptal Edildi" : "Reddedildi"}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                                <div style={{ fontSize: 22, fontWeight: 800 }}>
                                    {formatMoney(req.amount)}
                                </div>

                                {req.status === "pending" && (
                                    <div style={{ display: "flex", gap: 8 }}>
                                        {activeTab === "incoming" ? (
                                            <>
                                                <button onClick={() => setApproveModal({ show: true, request: req, account_id: "" })} style={approveButtonStyle} disabled={actionLoading}>Onayla & Öde</button>
                                                <button onClick={() => handleReject(req.request_id)} style={rejectButtonStyle} disabled={actionLoading}><Ban size={16} /></button>
                                            </>
                                        ) : (
                                            <button onClick={() => handleCancel(req.request_id)} style={rejectButtonStyle} disabled={actionLoading}>İptal Et</button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modals */}
            {showCreateModal && (
                <div style={modalOverlayStyle}>
                    <div style={modalContentStyle}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Yeni Ödeme İsteği</h2>
                            <button onClick={() => setShowCreateModal(false)} style={closeButtonStyle}><XCircle size={24} /></button>
                        </div>
                        <form onSubmit={handleCreateRequest} style={{ display: "grid", gap: 16 }}>
                            <div>
                                <label style={labelStyle}>Kimden İsteniyor? (Telefon, E-Posta veya TCKN)</label>
                                <input
                                    className="form-input"
                                    value={createForm.target_alias}
                                    onChange={e => setCreateForm(prev => ({ ...prev, target_alias: e.target.value }))}
                                    placeholder="Örn: 5XX1234567"
                                    required
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Tutar</label>
                                <input
                                    className="form-input"
                                    type="number"
                                    min="0.01" step="0.01"
                                    value={createForm.amount}
                                    onChange={e => setCreateForm(prev => ({ ...prev, amount: e.target.value }))}
                                    required
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Açıklama</label>
                                <input
                                    className="form-input"
                                    value={createForm.description}
                                    onChange={e => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Örn: Akşam Yemeği, Borç vs."
                                />
                            </div>
                            <button type="submit" style={{ ...primaryButtonStyle, width: "100%", marginTop: 8 }} disabled={actionLoading}>
                                {actionLoading ? <RefreshCw size={18} style={{ animation: "spin 1s linear infinite" }} /> : "İsteği Gönder"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {approveModal.show && (
                <div style={modalOverlayStyle}>
                    <div style={modalContentStyle}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Ödemeyi Onayla</h2>
                            <button onClick={() => setApproveModal({ show: false, request: null, account_id: "" })} style={closeButtonStyle}><XCircle size={24} /></button>
                        </div>
                        <div style={{ background: "var(--bg-secondary)", padding: 16, borderRadius: 12, marginBottom: 20, fontSize: 14 }}>
                            <strong>{approveModal.request.requester_name}</strong> adlı kişiye <strong>{formatMoney(approveModal.request.amount)}</strong> ödeme yapacaksınız.
                            <br />
                            Açıklama: {approveModal.request.description}
                        </div>
                        <form onSubmit={handleApprove} style={{ display: "grid", gap: 16 }}>
                            <div>
                                <label style={labelStyle}>Ödeme Yapılacak Hesap</label>
                                <select
                                    className="form-select"
                                    value={approveModal.account_id}
                                    onChange={e => setApproveModal(prev => ({ ...prev, account_id: e.target.value }))}
                                    required
                                >
                                    <option value="" disabled>Hesap Seçin</option>
                                    {accounts.map(acc => (
                                        <option key={acc.id || acc.account_id} value={acc.id || acc.account_id}>
                                            {acc.account_number} (Bakiye: {formatMoney(acc.balance)})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button type="submit" style={{ ...approveButtonStyle, width: "100%", padding: 14, fontSize: 15 }} disabled={actionLoading}>
                                {actionLoading ? <RefreshCw size={18} style={{ animation: "spin 1s linear infinite" }} /> : "Onayla ve Öde"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}

const primaryButtonStyle = {
    background: "#f59e0b",
    color: "#fff",
    border: "none",
    padding: "12px 20px",
    borderRadius: 14,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    transition: "opacity 0.2s"
};

const tabStyle = (active) => ({
    flex: 1,
    padding: "12px 16px",
    border: "none",
    background: active ? "var(--bg-card)" : "transparent",
    color: active ? "var(--text-primary)" : "var(--text-secondary)",
    fontWeight: active ? 800 : 600,
    fontSize: 14,
    borderRadius: 12,
    cursor: "pointer",
    transition: "all 0.2s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    boxShadow: active ? "0 2px 8px rgba(0,0,0,0.05)" : "none"
});

const approveButtonStyle = {
    background: "#22c55e",
    color: "#fff",
    border: "none",
    padding: "10px 16px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    transition: "background 0.2s",
};

const rejectButtonStyle = {
    background: "var(--bg-secondary)",
    color: "#ef4444",
    border: "1px solid var(--border-color)",
    padding: "10px 16px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transaction: "all 0.2s",
};

const modalOverlayStyle = {
    position: "fixed",
    top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.5)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 999
};

const modalContentStyle = {
    background: "var(--bg-card)",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 480,
    boxShadow: "0 20px 40px rgba(0,0,0,0.2)"
};

const labelStyle = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-secondary)",
    marginBottom: 8,
};

const closeButtonStyle = {
    background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: 0
};
