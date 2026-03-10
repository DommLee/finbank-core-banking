import { useState, useEffect } from "react";
import {
    DollarSign, Users, TrendingUp, Activity, Clock,
    ArrowUpRight, ArrowDownRight, Eye, AlertTriangle, Shield, Search, CheckCircle, XCircle, ShieldAlert
} from "lucide-react";
import { customerApi, accountApi, ledgerApi, auditApi, adminApi, approvalsApi } from "../../services/api";
import toast from "react-hot-toast";
import ApprovalCard from "../../components/ApprovalCard";
import { ListSkeleton } from "../../components/SkeletonLoader";

export default function ExecutiveCockpitPage() {
    const [stats, setStats] = useState({
        totalDeposit: 0,
        activeCustomers: 0,
        todayTransactions: 0,
        todayVolume: 0,
    });
    const [recentTx, setRecentTx] = useState([]);
    const [recentAudit, setRecentAudit] = useState([]);
    const [loading, setLoading] = useState(true);

    // CEO Management States
    const [users, setUsers] = useState([]);
    const [searchQ, setSearchQ] = useState("");
    const [tab, setTab] = useState("dashboard"); // dashboard, users, approvals
    const [approvals, setApprovals] = useState([]);

    useEffect(() => {
        if (tab === "dashboard") loadData();
        if (tab === "users") loadUsers();
    }, [tab, searchQ]);

    const loadUsers = async () => {
        try {
            const res = await adminApi.listUsers({ limit: 50, q: searchQ });
            setUsers(res.data?.data || []);
        } catch (err) {
            console.error("Users load err", err);
        }
    };

    const loadData = async () => {
        try {
            const [customersRes, accountsRes, ledgerRes, auditRes, appRes] = await Promise.allSettled([
                customerApi.listAll(),
                accountApi.listAll(),
                ledgerApi.getEntries({ limit: 10 }),
                auditApi.getLogs({ limit: 5 }),
                approvalsApi.getApprovals("PENDING_CEO"),
            ]);

            const customers = customersRes.status === "fulfilled" ? customersRes.value.data : [];
            const accounts = accountsRes.status === "fulfilled" ? accountsRes.value.data : [];
            const ledger = ledgerRes.status === "fulfilled" ? ledgerRes.value.data : [];
            const audit = auditRes.status === "fulfilled" ? auditRes.value.data : [];
            const appList = appRes.status === "fulfilled" ? appRes.value.data : [];

            const totalDeposit = Array.isArray(accounts)
                ? accounts.reduce((sum, a) => sum + (a.balance || 0), 0)
                : 0;

            const todayTx = Array.isArray(ledger) ? ledger : [];

            setStats({
                totalDeposit,
                activeCustomers: Array.isArray(customers) ? customers.length : 0,
                todayTransactions: todayTx.length,
                todayVolume: todayTx.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0),
            });
            setRecentTx(todayTx.slice(0, 8));
            setRecentAudit(Array.isArray(audit) ? audit.slice(0, 5) : []);
            setApprovals(Array.isArray(appList) ? appList : []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleApprovalAction = async (approvalId, actionStr) => {
        try {
            await approvalsApi.reviewApproval(approvalId, { action: actionStr, notes: "" });
            toast.success(actionStr === "APPROVE" ? "Talep onaylandı ve işleme alındı." : "Talep nihai olarak reddedildi.");
            loadData();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Onay işlemi başarısız.");
        }
    };

    const formatCurrency = (val) =>
        new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(val);

    const cardStyle = (gradient) => ({
        background: gradient,
        borderRadius: 16, padding: "24px 20px", color: "#fff",
        position: "relative", overflow: "hidden",
    });

    if (loading) {
        return (
            <div className="page-container" style={{ maxWidth: 1200 }}>
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
            <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
                        👑 CEO Kontrol Paneli
                    </h1>
                    <p style={{ color: "var(--text-muted)", fontSize: 14, margin: 0 }}>
                        Banka genelindeki finansal durumun canli gorunumu ve sistem yonetimi
                    </p>
                </div>
                <div style={{ display: "flex", gap: 8, background: "var(--bg-secondary)", padding: 6, borderRadius: 16 }}>
                    <button onClick={() => setTab("dashboard")} style={tabStyle(tab === "dashboard")}>
                        <Activity size={16} /> Finansal Özet
                    </button>
                    <button onClick={() => setTab("users")} style={tabStyle(tab === "users")}>
                        <Shield size={16} /> Kullanici Yönetimi
                    </button>
                    <button onClick={() => setTab("approvals")} style={tabStyle(tab === "approvals")}>
                        <ShieldAlert size={16} /> Son Onaylar
                        {approvals.length > 0 && (
                            <span style={{ background: "var(--danger)", color: "#fff", padding: "2px 6px", borderRadius: 10, fontSize: 10, marginLeft: 6 }}>{approvals.length}</span>
                        )}
                    </button>
                </div>
            </div>

            {tab === "users" && (
                <div className="card fade-in">
                    <div className="card-header" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16, borderBottom: "1px solid var(--border-color)", paddingBottom: 16, marginBottom: 16 }}>
                        <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <Users size={18} /> Sistem Kullanicilari
                        </h2>
                        <div style={{ display: "flex", alignItems: "center", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 12, padding: "0 12px" }}>
                            <Search size={16} color="var(--text-muted)" />
                            <input
                                type="text"
                                placeholder="E-posta ile ara..."
                                value={searchQ}
                                onChange={(e) => setSearchQ(e.target.value)}
                                style={{ background: "transparent", border: "none", color: "var(--text-primary)", padding: "10px", outline: "none", width: 220 }}
                            />
                        </div>
                    </div>

                    <div style={{ display: "grid", gap: 12 }}>
                        {users.length === 0 ? <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>Sonuç bulunamadi.</div> :
                            users.map(u => (
                                <div key={u.user_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 16, background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border-color)", transition: "all 0.2s ease" }} className="hover-scale">
                                    <div>
                                        <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                                            {u.email}
                                            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 12, background: u.role === "ceo" ? "#d4af37" : u.role === "admin" ? "#ef4444" : u.role === "employee" ? "#3b82f6" : "#22c55e", color: "#fff", fontWeight: 800, textTransform: "uppercase" }}>
                                                {u.role}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>ID: {u.user_id?.substring(0, 8)}...</div>
                                    </div>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        {u.role !== "ceo" && (
                                            <button onClick={async () => {
                                                if (window.confirm("Bu yetkiyi degistirmek istediginize emin misiniz?")) {
                                                    try {
                                                        await adminApi.changeRole(u.user_id, { role: "admin" });
                                                        toast.success("Admin yetkisi verildi!");
                                                        loadUsers();
                                                    } catch (e) { toast.error("Hata olustu"); }
                                                }
                                            }} style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.2s ease" }}>Admin Yap</button>
                                        )}
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {tab === "approvals" && (
                <div className="card fade-in">
                    <div className="card-header" style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: 16, marginBottom: 16 }}>
                        <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <ShieldAlert size={18} /> CEO Son Onay Bekleyen İşlemler
                        </h2>
                    </div>
                    {approvals.length === 0 ? (
                        <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
                            Şu an onay bekleyen kritik bir işlem bulunmuyor.
                        </div>
                    ) : approvals.map((req, i) => (
                        <ApprovalCard
                            key={req.id || i}
                            request={req}
                            onApprove={(id) => handleApprovalAction(id, "APPROVE")}
                            onReject={(id) => handleApprovalAction(id, "REJECT")}
                            isCeo={true}
                        />
                    ))}
                </div>
            )}

            {tab === "dashboard" && (
                <div className="fade-in">
                    {/* Stats Cards */}
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                        gap: 16, marginBottom: 28,
                    }}>
                        {/* Toplam Mevduat */}
                        <div style={cardStyle("linear-gradient(135deg, #d4af37, #b8860b)")}>
                            <div style={{ opacity: 0.2, position: "absolute", right: -10, top: -10 }}>
                                <DollarSign size={80} />
                            </div>
                            <DollarSign size={22} style={{ marginBottom: 8 }} />
                            <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 4 }}>Toplam Mevduat</div>
                            <div style={{ fontSize: 26, fontWeight: 800 }}>{formatCurrency(stats.totalDeposit)}</div>
                            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
                                <ArrowUpRight size={14} /> Tüm hesaplar toplamı
                            </div>
                        </div>

                        {/* Aktif Müşteri */}
                        <div style={cardStyle("linear-gradient(135deg, #7c3aed, #a855f7)")}>
                            <div style={{ opacity: 0.2, position: "absolute", right: -10, top: -10 }}>
                                <Users size={80} />
                            </div>
                            <Users size={22} style={{ marginBottom: 8 }} />
                            <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 4 }}>Aktif Müşteri</div>
                            <div style={{ fontSize: 26, fontWeight: 800 }}>{stats.activeCustomers}</div>
                            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
                                <TrendingUp size={14} /> Kayıtlı kullanıcılar
                            </div>
                        </div>

                        {/* İşlem Sayısı */}
                        <div style={cardStyle("linear-gradient(135deg, #059669, #10b981)")}>
                            <div style={{ opacity: 0.2, position: "absolute", right: -10, top: -10 }}>
                                <Activity size={80} />
                            </div>
                            <Activity size={22} style={{ marginBottom: 8 }} />
                            <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 4 }}>Son İşlem Sayısı</div>
                            <div style={{ fontSize: 26, fontWeight: 800 }}>{stats.todayTransactions}</div>
                            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
                                <Clock size={14} /> Toplam kayıtlı işlem
                            </div>
                        </div>

                        {/* İşlem Hacmi */}
                        <div style={cardStyle("linear-gradient(135deg, #dc2626, #ef4444)")}>
                            <div style={{ opacity: 0.2, position: "absolute", right: -10, top: -10 }}>
                                <TrendingUp size={80} />
                            </div>
                            <TrendingUp size={22} style={{ marginBottom: 8 }} />
                            <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 4 }}>İşlem Hacmi</div>
                            <div style={{ fontSize: 26, fontWeight: 800 }}>{formatCurrency(stats.todayVolume)}</div>
                            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
                                <ArrowUpRight size={14} /> Toplam hareket tutarı
                            </div>
                        </div>
                    </div>

                    {/* Two Column Layout */}
                    <div style={{
                        display: "grid", gridTemplateColumns: "1fr 1fr",
                        gap: 20,
                    }}>
                        {/* Son İşlemler */}
                        <div className="card" style={{ gridColumn: window.innerWidth < 768 ? "1 / -1" : undefined }}>
                            <div className="card-header" style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: 12 }}>
                                <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <Eye size={18} /> Son İşlemler
                                </h2>
                            </div>
                            <div style={{ padding: "8px 0" }}>
                                {recentTx.length === 0 ? (
                                    <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                                        Henüz işlem kaydı bulunmuyor.
                                    </div>
                                ) : (
                                    recentTx.map((tx, i) => (
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
                                                {tx.direction === "DEBIT" ? (
                                                    <><ArrowDownRight size={14} /> -{formatCurrency(Math.abs(tx.amount))}</>
                                                ) : (
                                                    <><ArrowUpRight size={14} /> +{formatCurrency(Math.abs(tx.amount))}</>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Son Denetim Kayıtları */}
                        <div className="card" style={{ gridColumn: window.innerWidth < 768 ? "1 / -1" : undefined }}>
                            <div className="card-header" style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: 12 }}>
                                <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <AlertTriangle size={18} /> Son Denetim Kayıtları
                                </h2>
                            </div>
                            <div style={{ padding: "8px 0" }}>
                                {recentAudit.length === 0 ? (
                                    <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                                        Henüz denetim kaydı bulunmuyor.
                                    </div>
                                ) : (
                                    recentAudit.map((log, i) => (
                                        <div key={i} style={{
                                            display: "flex", justifyContent: "space-between", alignItems: "center",
                                            padding: "10px 16px", borderBottom: i < recentAudit.length - 1 ? "1px solid var(--border-color)" : "none",
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: 13 }}>
                                                    {log.action}
                                                </div>
                                                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                                    {log.user_email || "Sistem"}
                                                </div>
                                            </div>
                                            <span style={{
                                                padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                                                background: log.outcome === "SUCCESS" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                                                color: log.outcome === "SUCCESS" ? "#10b981" : "#ef4444",
                                            }}>
                                                {log.outcome}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
            .hover-scale:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            `}</style>
        </div>
    );
}

const tabStyle = (active) => ({
    display: "flex", alignItems: "center", gap: 6,
    padding: "8px 16px", borderRadius: 12, border: "none", cursor: "pointer",
    background: active ? "var(--accent)" : "transparent",
    color: active ? "#ffffff" : "var(--text-muted)",
    fontWeight: 600, transition: "all 0.2s ease",
});
