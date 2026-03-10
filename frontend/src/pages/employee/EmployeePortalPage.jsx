import { useState, useEffect } from "react";
import {
    Users, FileCheck, Activity, Search,
    ArrowUpRight, ArrowDownRight, ShieldAlert,
    CheckCircle, XCircle, Clock, Eye
} from "lucide-react";
import { customerApi, accountApi, ledgerApi, transactionApi, approvalsApi } from "../../services/api";
import toast from "react-hot-toast";
import ApprovalCard from "../../components/ApprovalCard";
import { ListSkeleton } from "../../components/SkeletonLoader";

export default function EmployeePortalPage() {
    const [customers, setCustomers] = useState([]);
    const [filteredCustomers, setFilteredCustomers] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [recentTx, setRecentTx] = useState([]);
    const [stats, setStats] = useState({ total: 0, pending: 0, verified: 0, todayTx: 0 });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("overview");
    const [approvals, setApprovals] = useState([]);

    // 360 Modal States
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerAccounts, setCustomerAccounts] = useState([]);
    const [depositModalOpen, setDepositModalOpen] = useState(false);
    const [depositForm, setDepositForm] = useState({ accountId: "", amount: "", description: "" });
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (searchTerm) {
            setFilteredCustomers(
                customers.filter(c =>
                    (c.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (c.email || "").toLowerCase().includes(searchTerm.toLowerCase())
                )
            );
        } else {
            setFilteredCustomers(customers);
        }
    }, [searchTerm, customers]);

    const loadData = async () => {
        try {
            const [cusRes, ledRes, appRes] = await Promise.allSettled([
                customerApi.listAll(),
                ledgerApi.getEntries({ limit: 10 }),
                approvalsApi.getApprovals("PENDING_EMPLOYER"),
            ]);

            const cusList = cusRes.status === "fulfilled" ? (Array.isArray(cusRes.value.data) ? cusRes.value.data : []) : [];
            const txList = ledRes.status === "fulfilled" ? (Array.isArray(ledRes.value.data) ? ledRes.value.data : []) : [];
            const appList = appRes.status === "fulfilled" ? (Array.isArray(appRes.value.data) ? appRes.value.data : []) : [];

            setCustomers(cusList);
            setFilteredCustomers(cusList);
            setRecentTx(txList.slice(0, 8));
            setApprovals(appList);

            setStats({
                total: cusList.length,
                pending: cusList.filter(c => c.status === "pending").length,
                verified: cusList.filter(c => c.status === "active").length,
                todayTx: txList.length,
            });
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleKycAction = async (customerId, action) => {
        try {
            await customerApi.updateStatus(customerId, {
                status: action === "approve" ? "active" : "suspended",
                kyc_verified: action === "approve" ? true : false,
            });
            toast.success(action === "approve" ? "KYC onaylandı! ✅" : "KYC reddedildi.");
            loadData();
        } catch (err) {
            toast.error(err.response?.data?.detail || "İşlem başarısız.");
        }
    };

    const handleApprovalAction = async (approvalId, actionStr) => {
        try {
            // actionStr is "APPROVE" or "REJECT"
            await approvalsApi.reviewApproval(approvalId, { action: actionStr, notes: "" });
            toast.success(actionStr === "APPROVE" ? "Talep üst onaya (CEO) gönderildi." : "Talep reddedildi.");
            loadData();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Onay işlemi başarısız.");
        }
    };

    const openCustomerModal = async (customer) => {
        setSelectedCustomer(customer);
        setCustomerAccounts([]);
        try {
            const res = await accountApi.listByCustomer(customer.id);
            if (Array.isArray(res.data)) {
                setCustomerAccounts(res.data);
            }
        } catch (err) {
            toast.error("Müşteri hesapları alınamadı.");
        }
    };

    const handleDeposit = async (e) => {
        e.preventDefault();
        if (!depositForm.amount || depositForm.amount <= 0) return toast.error("Geçerli bir tutar girin.");
        setActionLoading(true);
        try {
            await transactionApi.deposit({
                account_id: depositForm.accountId,
                amount: parseFloat(depositForm.amount),
                description: depositForm.description || "Gişe Yatırımı (Personel İşlemi)"
            });
            toast.success("Para yatırma başarılı! ✅");
            setDepositModalOpen(false);
            setDepositForm({ accountId: "", amount: "", description: "" });
            openCustomerModal(selectedCustomer); // Refresh accounts
            loadData(); // Refresh history
        } catch (err) {
            toast.error(err.response?.data?.detail || "İşlem başarısız.");
        } finally {
            setActionLoading(false);
        }
    };

    const formatCurrency = (val) =>
        new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(val || 0);

    const tabs = [
        { id: "overview", label: "📊 Genel Bakış", icon: Activity },
        { id: "customers", label: "👥 Müşteriler", icon: Users },
        { id: "kyc", label: "📋 KYC Onay", icon: FileCheck },
        { id: "approvals", label: "📋 Bekleyen Onaylar", icon: ShieldAlert },
    ];

    if (loading) {
        return (
            <div className="page-container" style={{ maxWidth: 800 }}>
                <div style={{ marginBottom: 20 }}>
                    <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Yükleniyor...</h1>
                </div>
                <ListSkeleton count={4} />
            </div>
        );
    }

    return (
        <div className="page-container" style={{ maxWidth: 1200 }}>
            {/* Header */}
            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>
                    👔 Çalışan İşlem Paneli
                </h1>
                <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
                    Müşteri yönetimi, KYC onay ve işlem takibi
                </p>
            </div>

            {/* Tabs */}
            <div style={{
                display: "flex", gap: 8, marginBottom: 24,
                overflowX: "auto", paddingBottom: 4,
            }}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            padding: "10px 20px", borderRadius: 12, border: "none",
                            fontWeight: 600, fontSize: 14, cursor: "pointer",
                            whiteSpace: "nowrap",
                            background: activeTab === tab.id
                                ? "linear-gradient(135deg, #3b82f6, #60a5fa)"
                                : "var(--bg-secondary)",
                            color: activeTab === tab.id ? "#fff" : "var(--text-secondary)",
                            transition: "all 0.2s",
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Overview Tab */}
            {activeTab === "overview" && (
                <>
                    {/* Stats */}
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                        gap: 14, marginBottom: 24,
                    }}>
                        <StatCard icon={<Users size={20} />} label="Toplam Müşteri" value={stats.total}
                            gradient="linear-gradient(135deg, #3b82f6, #60a5fa)" />
                        <StatCard icon={<Clock size={20} />} label="Bekleyen KYC" value={stats.pending}
                            gradient="linear-gradient(135deg, #f59e0b, #fbbf24)" />
                        <StatCard icon={<CheckCircle size={20} />} label="Onaylı Müşteri" value={stats.verified}
                            gradient="linear-gradient(135deg, #10b981, #34d399)" />
                        <StatCard icon={<Activity size={20} />} label="Son İşlemler" value={stats.todayTx}
                            gradient="linear-gradient(135deg, #8b5cf6, #a78bfa)" />
                    </div>

                    {/* Recent Transactions */}
                    <div className="card">
                        <div className="card-header" style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: 12 }}>
                            <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <Eye size={18} /> Son İşlemler
                            </h2>
                        </div>
                        <div>
                            {recentTx.length === 0 ? (
                                <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
                                    Henüz işlem kaydı yok.
                                </div>
                            ) : recentTx.map((tx, i) => (
                                <div key={i} style={{
                                    display: "flex", justifyContent: "space-between", alignItems: "center",
                                    padding: "10px 16px", borderBottom: i < recentTx.length - 1 ? "1px solid var(--border-color)" : "none",
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                                            {tx.type === "DEPOSIT" ? "💰 Yatırma" :
                                                tx.type === "WITHDRAW" ? "💸 Çekme" :
                                                    tx.type === "TRANSFER" ? "🔄 Transfer" : tx.type}
                                        </div>
                                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                            {tx.account_id?.slice(0, 8)}...
                                        </div>
                                    </div>
                                    <div style={{
                                        fontWeight: 700, fontSize: 14,
                                        color: tx.direction === "DEBIT" ? "var(--danger)" : "var(--success)",
                                    }}>
                                        {tx.direction === "DEBIT" ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                                        {formatCurrency(Math.abs(tx.amount))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* Customers Tab */}
            {activeTab === "customers" && (
                <div className="card">
                    <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color)" }}>
                        <div style={{ position: "relative" }}>
                            <Search size={16} style={{
                                position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                                color: "var(--text-muted)",
                            }} />
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Müşteri ara... (isim veya e-posta)"
                                style={{ paddingLeft: 38 }}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    {filteredCustomers.length === 0 ? (
                        <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
                            {searchTerm ? "Sonuç bulunamadı." : "Kayıtlı müşteri yok."}
                        </div>
                    ) : filteredCustomers.map((c, i) => (
                        <div key={c.id || i}
                            onClick={() => openCustomerModal(c)}
                            style={{
                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                padding: "14px 20px", cursor: "pointer",
                                borderBottom: i < filteredCustomers.length - 1 ? "1px solid var(--border-color)" : "none",
                                transition: "background 0.2s",
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-secondary)"}
                            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{
                                    width: 40, height: 40, borderRadius: 12,
                                    background: "linear-gradient(135deg, #3b82f6, #60a5fa)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    color: "#fff", fontWeight: 700, fontSize: 14,
                                }}>
                                    {(c.full_name || "?").charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 14 }}>{c.full_name || "—"}</div>
                                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{c.email || "—"}</div>
                                </div>
                            </div>
                            <span style={{
                                padding: "3px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                                background: c.status === "active" ? "rgba(16,185,129,0.15)" :
                                    c.status === "suspended" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
                                color: c.status === "active" ? "#10b981" :
                                    c.status === "suspended" ? "#ef4444" : "#f59e0b",
                            }}>
                                {c.status ? c.status.toUpperCase() : "PENDING"}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* KYC Tab */}
            {activeTab === "kyc" && (
                <div className="card">
                    <div className="card-header" style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: 12 }}>
                        <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <FileCheck size={18} /> Bekleyen KYC Onayları
                        </h2>
                    </div>
                    {customers.filter(c => c.status === "pending").length === 0 ? (
                        <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
                            ✅ Bekleyen KYC onayı yok!
                        </div>
                    ) : customers.filter(c => c.status === "pending").map((c, i) => (
                        <div key={c.id || i} style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "14px 20px", flexWrap: "wrap", gap: 12,
                            borderBottom: "1px solid var(--border-color)",
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{
                                    width: 44, height: 44, borderRadius: 12,
                                    background: "linear-gradient(135deg, #f59e0b, #fbbf24)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    color: "#fff", fontWeight: 700, fontSize: 16,
                                }}>
                                    {(c.full_name || "?").charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 14 }}>{c.full_name || "—"}</div>
                                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{c.email || "—"}</div>
                                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Tel: {c.phone || "—"}</div>
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                                <button
                                    onClick={() => handleKycAction(c.id, "approve")}
                                    style={{
                                        padding: "8px 16px", borderRadius: 10, border: "none",
                                        background: "linear-gradient(135deg, #10b981, #34d399)",
                                        color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer",
                                        display: "flex", alignItems: "center", gap: 6,
                                    }}
                                >
                                    <CheckCircle size={14} /> Onayla
                                </button>
                                <button
                                    onClick={() => handleKycAction(c.id, "reject")}
                                    style={{
                                        padding: "8px 16px", borderRadius: 10, border: "none",
                                        background: "linear-gradient(135deg, #ef4444, #f87171)",
                                        color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer",
                                        display: "flex", alignItems: "center", gap: 6,
                                    }}
                                >
                                    <XCircle size={14} /> Reddet
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Approvals Tab */}
            {activeTab === "approvals" && (
                <div className="card">
                    <div className="card-header" style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: 12 }}>
                        <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <ShieldAlert size={18} /> Yüksek Riskli İşlem Onayları
                        </h2>
                    </div>
                    {approvals.length === 0 ? (
                        <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
                            Şu an bekleyen onay talebi bulunmuyor.
                        </div>
                    ) : approvals.map((req, i) => (
                        <ApprovalCard
                            key={req.id || i}
                            request={req}
                            onApprove={(id) => handleApprovalAction(id, "APPROVE")}
                            onReject={(id) => handleApprovalAction(id, "REJECT")}
                            isCeo={false}
                        />
                    ))}
                </div>
            )}

            {/* Müşteri 360 Modal */}
            {selectedCustomer && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(0,0,0,0.5)", zIndex: 1000,
                    display: "flex", alignItems: "center", justifyContent: "center", padding: 20
                }}>
                    <div className="card" style={{ width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto", position: "relative" }}>
                        <button onClick={() => setSelectedCustomer(null)} style={{
                            position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)"
                        }}>
                            <XCircle size={24} />
                        </button>

                        <div style={{ padding: 24 }}>
                            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Müşteri 360° Görünümü</h2>

                            <div style={{ background: "var(--bg-secondary)", padding: 16, borderRadius: 12, marginBottom: 20 }}>
                                <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{selectedCustomer.full_name}</div>
                                <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>{selectedCustomer.email} • {selectedCustomer.phone}</div>
                                <div style={{ display: "flex", gap: 10 }}>
                                    <span style={{ padding: "4px 8px", background: "var(--border-color)", borderRadius: 6, fontSize: 12 }}>
                                        TC: {selectedCustomer.national_id}
                                    </span>
                                    <span style={{ padding: "4px 8px", background: "var(--border-color)", borderRadius: 6, fontSize: 12 }}>
                                        Durum: {selectedCustomer.status}
                                    </span>
                                </div>
                            </div>

                            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Hesaplar ve Bakiyeler</h3>
                            {customerAccounts.length === 0 ? (
                                <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", background: "var(--bg-secondary)", borderRadius: 12 }}>
                                    Müşteriye ait hesap bulunmuyor.
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                                    {customerAccounts.map(acc => (
                                        <div key={acc.id} style={{
                                            border: "1px solid var(--border-color)", padding: 12, borderRadius: 10,
                                            display: "flex", justifyContent: "space-between", alignItems: "center"
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: 14 }}>{acc.account_type} Hesabı</div>
                                                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{acc.iban || acc.account_number}</div>
                                            </div>
                                            <button onClick={() => {
                                                setDepositForm({ ...depositForm, accountId: acc.id });
                                                setDepositModalOpen(true);
                                            }} style={{
                                                padding: "6px 12px", background: "linear-gradient(135deg, #10b981, #34d399)",
                                                color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer"
                                            }}>
                                                Para Yatır
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Deposit Form Modal */}
            {depositModalOpen && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(0,0,0,0.6)", zIndex: 1010,
                    display: "flex", alignItems: "center", justifyContent: "center", padding: 20
                }}>
                    <form onSubmit={handleDeposit} className="card" style={{ width: "100%", maxWidth: 400, padding: 24, position: "relative" }}>
                        <button type="button" onClick={() => setDepositModalOpen(false)} style={{
                            position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)"
                        }}>
                            <XCircle size={24} />
                        </button>
                        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Gişeden Para Yatırma</h3>

                        <div style={{ marginBottom: 16 }}>
                            <label className="form-label">Tutar (TRY)</label>
                            <input type="number" step="0.01" className="form-input" required
                                value={depositForm.amount} onChange={e => setDepositForm({ ...depositForm, amount: e.target.value })}
                                placeholder="Örn: 5000" />
                        </div>
                        <div style={{ marginBottom: 20 }}>
                            <label className="form-label">Açıklama (Opsiyonel)</label>
                            <input type="text" className="form-input"
                                value={depositForm.description} onChange={e => setDepositForm({ ...depositForm, description: e.target.value })}
                                placeholder="Gişe nakit yatırma" />
                        </div>
                        <button type="submit" disabled={actionLoading} style={{
                            width: "100%", padding: 12, borderRadius: 10, border: "none",
                            background: "linear-gradient(135deg, #3b82f6, #60a5fa)", color: "#fff", fontWeight: 600, cursor: actionLoading ? "not-allowed" : "pointer"
                        }}>
                            {actionLoading ? "İşleniyor..." : "Yatırımı Onayla"}
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}

function StatCard({ icon, label, value, gradient }) {
    return (
        <div style={{
            background: gradient, borderRadius: 14,
            padding: "18px 16px", color: "#fff",
        }}>
            <div style={{ marginBottom: 8, opacity: 0.9 }}>{icon}</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{value}</div>
        </div>
    );
}
