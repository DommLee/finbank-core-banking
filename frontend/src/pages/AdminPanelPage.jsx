import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
    Activity,
    AlertTriangle,
    Crown,
    CreditCard,
    Eye,
    FileText,
    Loader2,
    Mail,
    MessageSquare,
    RefreshCw,
    Shield,
    Trash2,
    UserCheck,
    UserX,
    Users,
} from "lucide-react";
import { adminApi, employeeApi, approvalsApi } from "../services/api";

const ROLE_OPTIONS = ["customer", "employee", "admin", "ceo"];
const PAGE_SIZE = 12;

export default function AdminPanelPage() {
    const [tab, setTab] = useState("overview");
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [userTotal, setUserTotal] = useState(0);
    const [messages, setMessages] = useState([]);
    const [bills, setBills] = useState([]);
    const [approvals, setApprovals] = useState([]);
    const [kycRequests, setKycRequests] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    const [roleFilter, setRoleFilter] = useState("");
    const [searchQ, setSearchQ] = useState("");
    const [page, setPage] = useState(1);
    const [busyKey, setBusyKey] = useState("");

    useEffect(() => {
        if (tab === "overview") loadOverview();
        if (tab === "users") loadUsers();
        if (tab === "messages") loadMessages();
        if (tab === "approvals") loadApprovals();
    }, [tab, page, roleFilter]); // searchQ is intentionally left out to trigger on search button

    const loadOverview = async () => {
        setLoading(true);
        try {
            const [statsRes, usersRes, messagesRes, billsRes] = await Promise.all([
                adminApi.systemStats(),
                adminApi.listUsers({ page: 1, limit: 8 }),
                adminApi.allMessages({ page: 1, limit: 8 }),
                adminApi.allBills({ page: 1, limit: 8 }),
            ]);
            setStats(statsRes.data);
            setUsers(usersRes.data?.data || []);
            setUserTotal(usersRes.data?.total || 0);
            setMessages(messagesRes.data?.data || []);
            setBills(billsRes.data?.data || []);
        } catch {
            toast.error("Admin dashboard verileri yuklenemedi.");
        } finally {
            setLoading(false);
        }
    };

    const loadUsers = async () => {
        setLoading(true);
        try {
            const params = { page, limit: PAGE_SIZE };
            if (roleFilter) params.role = roleFilter;
            if (searchQ) params.q = searchQ;
            const res = await adminApi.listUsers(params);
            setUsers(res.data?.data || []);
            setUserTotal(res.data?.total || 0);
        } catch {
            toast.error("Kullanici listesi yuklenemedi.");
        } finally {
            setLoading(false);
        }
    };

    const loadMessages = async () => {
        setLoading(true);
        try {
            const [messagesRes, billsRes] = await Promise.all([
                adminApi.allMessages({ page: 1, limit: 30 }),
                adminApi.allBills({ page: 1, limit: 20 }),
            ]);
            setMessages(messagesRes.data?.data || []);
            setBills(billsRes.data?.data || []);
        } catch {
            toast.error("Mesaj ve odeme listeleri yuklenemedi.");
        } finally {
            setLoading(false);
        }
    };

    const loadApprovals = async () => {
        setLoading(true);
        try {
            const [appRes, kycRes] = await Promise.all([
                approvalsApi.getApprovals(),
                employeeApi.pendingKYC()
            ]);
            setApprovals(appRes.data || []);
            setKycRequests(kycRes.data || []);
        } catch {
            toast.error("Onay listeleri yuklenemedi.");
        } finally {
            setLoading(false);
        }
    };

    const handleKycDecision = async (id, decision) => {
        setBusyKey(`kyc-${id}`);
        try {
            await employeeApi.kycDecision(id, { decision, notes: "Admin panelinden eklendi." });
            toast.success("KYC karari islendi.");
            loadApprovals();
        } catch (error) {
            toast.error(error.response?.data?.detail || "KYC guncellemesi basarisiz.");
        } finally {
            setBusyKey("");
        }
    };

    const handleApprovalReview = async (id, action) => {
        setBusyKey(`appr-${id}`);
        try {
            await approvalsApi.reviewApproval(id, { action, notes: "Admin panelinden islendi." });
            toast.success("Islem basarili.");
            loadApprovals();
        } catch (error) {
            toast.error(error.response?.data?.detail || "Onay islemi basarisiz.");
        } finally {
            setBusyKey("");
        }
    };

    const openUser = async (userId) => {
        setDetailLoading(true);
        try {
            const res = await adminApi.getUser(userId);
            setSelectedUser(res.data);
        } catch {
            toast.error("Kullanici detayi yuklenemedi.");
        } finally {
            setDetailLoading(false);
        }
    };

    const changeRole = async (userId, role) => {
        setBusyKey(`role-${userId}`);
        try {
            await adminApi.changeRole(userId, { role });
            toast.success("Rol guncellendi.");
            loadUsers();
            if (selectedUser?.user?.user_id === userId) openUser(userId);
        } catch (error) {
            toast.error(error.response?.data?.detail || "Rol guncellenemedi.");
        } finally {
            setBusyKey("");
        }
    };

    const toggleStatus = async (user) => {
        const next = !user.is_active;
        setBusyKey(`status-${user.user_id}`);
        try {
            await adminApi.toggleStatus(user.user_id, { is_active: next });
            toast.success(next ? "Kullanici aktiflesti." : "Kullanici pasife alindi.");
            loadUsers();
            if (selectedUser?.user?.user_id === user.user_id) openUser(user.user_id);
        } catch (error) {
            toast.error(error.response?.data?.detail || "Durum guncellenemedi.");
        } finally {
            setBusyKey("");
        }
    };

    const removeUser = async (userId) => {
        if (!window.confirm("Bu kullaniciyi silmek istiyor musunuz?")) return;
        setBusyKey(`delete-${userId}`);
        try {
            await adminApi.deleteUser(userId);
            toast.success("Kullanici silindi.");
            setSelectedUser((current) => (current?.user?.user_id === userId ? null : current));
            loadUsers();
        } catch (error) {
            toast.error(error.response?.data?.detail || "Kullanici silinemedi.");
        } finally {
            setBusyKey("");
        }
    };

    const inactiveUsers = Math.max(Number(stats?.total_users || 0) - Number(stats?.active_users || 0), 0);
    const totalPages = Math.max(1, Math.ceil(Number(userTotal || 0) / PAGE_SIZE));
    const roles = [
        { key: "", label: "Tum roller" },
        { key: "customer", label: "Customer" },
        { key: "employee", label: "Employee" },
        { key: "admin", label: "Admin" },
        { key: "ceo", label: "CEO" },
    ];

    return (
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                        <div style={iconBox("rgba(245,158,11,0.12)", "#f59e0b")}><Crown size={22} /></div>
                        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900 }}>Admin dashboard</h1>
                    </div>
                    <p style={{ margin: 0, color: "var(--text-secondary)" }}>Kullanici, kuyruk ve mesaj akislarini merkezi olarak yonetin.</p>
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => toast.success("Sistem bakima alindi (Mock)")} style={dangerGhostStyle}>
                        <AlertTriangle size={16} /> Sistemi Duraklat
                    </button>
                    <button type="button" onClick={() => { setPage(1); if (tab === "overview") loadOverview(); if (tab === "users") loadUsers(); if (tab === "messages") loadMessages(); if (tab === "approvals") loadApprovals(); }} style={secondaryButtonStyle}>
                        <RefreshCw size={16} /> Yenile
                    </button>
                </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                {[
                    { id: "overview", label: "Overview" },
                    { id: "users", label: "Users" },
                    { id: "messages", label: "Messages" },
                    { id: "approvals", label: "Onaylar & KYC" },
                ].map((item) => (
                    <button key={item.id} type="button" onClick={() => { setPage(1); setTab(item.id) }} style={tabButtonStyle(tab === item.id)}>{item.label}</button>
                ))}
            </div>

            {loading ? <LoadingState /> : null}

            {!loading && tab === "overview" ? (
                <div style={{ display: "grid", gap: 16 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
                        <MetricCard icon={<Users size={18} />} label="Toplam kullanici" value={formatNumber(stats?.total_users)} tone="#2563eb" />
                        <MetricCard icon={<UserCheck size={18} />} label="Aktif kullanici" value={formatNumber(stats?.active_users)} tone="#10b981" />
                        <MetricCard icon={<CreditCard size={18} />} label="Toplam hesap" value={formatNumber(stats?.total_accounts)} tone="#8b5cf6" />
                        <MetricCard icon={<Activity size={18} />} label="Toplam islem" value={formatNumber(stats?.total_transactions)} tone="#f59e0b" />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
                        <QueueCard icon={<AlertTriangle size={16} />} label="Bekleyen KYC" value={stats?.pending_kyc} tone="#f59e0b" />
                        <QueueCard icon={<Mail size={16} />} label="Acik mesaj" value={stats?.open_messages} tone="#ef4444" />
                        <QueueCard icon={<Shield size={16} />} label="Donuk hesap" value={stats?.frozen_accounts} tone="#6366f1" />
                        <QueueCard icon={<UserX size={16} />} label="Pasif kullanici" value={inactiveUsers} tone="#64748b" />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16 }}>
                        <Panel title="Son kullanicilar" subtitle="Yeni kayitlari hizli inceleyin">
                            {users.length === 0 ? <Empty message="Kullanici kaydi yok." /> : users.map((user) => (
                                <div key={user.user_id} style={rowStyle}>
                                    <div>
                                        <div style={{ fontWeight: 700 }}>{user.email}</div>
                                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{user.role} - {user.is_active ? "active" : "passive"}</div>
                                    </div>
                                    <button type="button" onClick={() => openUser(user.user_id)} style={secondaryButtonStyle}><Eye size={14} /> Detay</button>
                                </div>
                            ))}
                        </Panel>

                        <Panel title="Mesaj ve odeme akisi" subtitle="Operasyon sinyallerini kacirmayin">
                            <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
                                {(messages || []).slice(0, 4).map((message) => (
                                    <div key={message.message_id} style={messageStyle(message.status === "open")}>
                                        <div style={{ fontWeight: 700, marginBottom: 6 }}>{message.subject}</div>
                                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>{message.sender_email}</div>
                                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{formatDateTime(message.created_at)}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: "grid", gap: 10 }}>
                                {(bills || []).slice(0, 4).map((bill) => (
                                    <div key={bill.bill_id || `${bill.provider}-${bill.subscriber_no}`} style={rowStyle}>
                                        <div>
                                            <div style={{ fontWeight: 700 }}>{bill.provider || bill.bill_type || "Bill"}</div>
                                            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{formatDate(bill.paid_at || bill.created_at)}</div>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <FileText size={14} />
                                            <strong>{formatMoney(bill.amount)}</strong>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Panel>
                    </div>
                </div>
            ) : null}

            {!loading && tab === "users" ? (
                <div style={{ display: "grid", gridTemplateColumns: selectedUser ? "1.2fr 0.8fr" : "1fr", gap: 16 }}>
                    <Panel title="Kullanici yonetimi" subtitle="Rol, durum ve silme islemleri">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {roles.map((role) => (
                                    <button key={role.key || "all"} type="button" onClick={() => { setPage(1); setRoleFilter(role.key); }} style={filterButtonStyle(roleFilter === role.key)}>{role.label}</button>
                                ))}
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                                <input placeholder="E-posta veya hesap ara..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} style={inputStyle} onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); loadUsers(); } }} />
                                <button type="button" onClick={() => { setPage(1); loadUsers(); }} style={secondaryButtonStyle}>Ara</button>
                            </div>
                        </div>
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                                        {['Kullanici', 'Rol', 'Durum', 'Kayit', 'Aksiyon'].map((head) => <th key={head} style={tableHeadStyle}>{head}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user) => (
                                        <tr key={user.user_id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                                            <td style={tableCellStyle}>
                                                <div style={{ fontWeight: 700 }}>{user.email}</div>
                                                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{user.user_id}</div>
                                            </td>
                                            <td style={tableCellStyle}>
                                                <select value={user.role} onChange={(event) => changeRole(user.user_id, event.target.value)} disabled={busyKey === `role-${user.user_id}`} style={selectStyle}>
                                                    {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
                                                </select>
                                            </td>
                                            <td style={tableCellStyle}><Status active={user.is_active}>{user.is_active ? "active" : "passive"}</Status></td>
                                            <td style={tableCellStyle}>{formatDate(user.created_at)}</td>
                                            <td style={tableCellStyle}>
                                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                                    <button type="button" onClick={() => openUser(user.user_id)} style={secondaryButtonStyle}><Eye size={14} /> Detay</button>
                                                    <button type="button" onClick={() => toggleStatus(user)} disabled={busyKey === `status-${user.user_id}`} style={user.is_active ? dangerButtonStyle : successButtonStyle}>{user.is_active ? <UserX size={14} /> : <UserCheck size={14} />}{user.is_active ? "Pasife al" : "Ac"}</button>
                                                    <button type="button" onClick={() => removeUser(user.user_id)} disabled={busyKey === `delete-${user.user_id}`} style={dangerGhostStyle}><Trash2 size={14} /> Sil</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
                            <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{formatNumber(userTotal)} kayit - sayfa {page}/{totalPages}</span>
                            <div style={{ display: "flex", gap: 8 }}>
                                <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} style={secondaryButtonStyle}>Geri</button>
                                <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages} style={secondaryButtonStyle}>Ileri</button>
                            </div>
                        </div>
                    </Panel>
                    {selectedUser ? <UserDetailCard data={selectedUser} loading={detailLoading} /> : null}
                </div>
            ) : null}

            {!loading && tab === "messages" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16 }}>
                    <Panel title="Mesaj merkezi" subtitle="Tum acik ve yanitlanmis mesajlar">
                        {messages.length === 0 ? <Empty message="Mesaj yok." /> : messages.map((message) => (
                            <div key={message.message_id} style={messageStyle(message.status === "open")}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                                    <strong>{message.subject}</strong>
                                    <Status active={message.status !== "open"}>{message.status}</Status>
                                </div>
                                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 8 }}>{message.body}</div>
                                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{message.sender_email} - {formatDateTime(message.created_at)}</div>
                                {message.reply ? <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "var(--bg-card)" }}>{message.reply}</div> : null}
                            </div>
                        ))}
                    </Panel>
                    <Panel title="Odeme listesi" subtitle="Son gelen bill islemleri">
                        {bills.length === 0 ? <Empty message="Odeme kaydi yok." /> : bills.map((bill) => (
                            <div key={bill.bill_id || `${bill.provider}-${bill.subscriber_no}`} style={rowStyle}>
                                <div>
                                    <div style={{ fontWeight: 700 }}>{bill.provider || bill.bill_type || "Bill"}</div>
                                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{bill.subscriber_no || "-"} - {formatDateTime(bill.paid_at || bill.created_at)}</div>
                                </div>
                                <strong>{formatMoney(bill.amount)}</strong>
                            </div>
                        ))}
                    </Panel>
                </div>
            ) : null}

            {!loading && tab === "approvals" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
                    <Panel title="Bekleyen KYC Talepleri" subtitle="Hesap onayi bekleyen musteriler">
                        {kycRequests.length === 0 ? <Empty message="Bekleyen KYC talebi yok." /> : (
                            <div style={{ display: "grid", gap: 10 }}>
                                {kycRequests.map(k => (
                                    <div key={k.customer_id} style={rowStyle}>
                                        <div>
                                            <div style={{ fontWeight: 700 }}>{k.full_name || k.user?.email || "Isim belirtilmemis"}</div>
                                            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>TC: {k.national_id} | E-Posta: {k.email || k.user?.email}</div>
                                        </div>
                                        <div style={{ display: "flex", gap: 8 }}>
                                            <button
                                                style={successButtonStyle}
                                                disabled={busyKey === `kyc-${k.customer_id}`}
                                                onClick={() => handleKycDecision(k.customer_id, "approved")}
                                            ><UserCheck size={14} /> Onayla</button>
                                            <button
                                                style={dangerButtonStyle}
                                                disabled={busyKey === `kyc-${k.customer_id}`}
                                                onClick={() => handleKycDecision(k.customer_id, "rejected")}
                                            ><UserX size={14} /> Reddet</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Panel>

                    <Panel title="Riskli ve Buyuk Islemler (Approvals)" subtitle="Islem onayi bekleyen talepler (Orn. Limit Artisi, Buyuk Transfer)">
                        {approvals.length === 0 ? <Empty message="Bekleyen islem onayi yok." /> : (
                            <div style={{ display: "grid", gap: 10 }}>
                                {approvals.map(a => (
                                    <div key={a.id} style={rowStyle}>
                                        <div>
                                            <div style={{ fontWeight: 700 }}>{a.user_name} - {a.request_type}</div>
                                            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                                                {formatMoney(a.amount)} | Risk: <strong style={{ color: a.risk_score === "HIGH" ? "#ef4444" : a.risk_score === "MEDIUM" ? "#f59e0b" : "#10b981" }}>{a.risk_score}</strong> | Durum: {a.status}
                                            </div>
                                            {a.description && <div style={{ fontSize: 12, marginTop: 4 }}>{a.description}</div>}
                                        </div>
                                        <div style={{ display: "flex", gap: 8 }}>
                                            <button
                                                style={successButtonStyle}
                                                disabled={busyKey === `appr-${a.id}`}
                                                onClick={() => handleApprovalReview(a.id, "APPROVE")}
                                            ><UserCheck size={14} /> Onayla</button>
                                            <button
                                                style={dangerButtonStyle}
                                                disabled={busyKey === `appr-${a.id}`}
                                                onClick={() => handleApprovalReview(a.id, "REJECT")}
                                            ><UserX size={14} /> Reddet</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Panel>
                </div>
            ) : null}
        </div>
    );
}

function UserDetailCard({ data, loading }) {
    return (
        <Panel title="Secili kullanici" subtitle="Kullanici, profil ve hesap ozeti">
            {loading ? <LoadingState compact /> : (
                <div style={{ display: "grid", gap: 12 }}>
                    <div style={infoStyle}><strong>{data.user?.email || "-"}</strong><span>{data.user?.role || "-"}</span></div>
                    <div style={infoStyle}>KYC: {data.user?.kyc_status || data.customer?.status || "-"}</div>
                    <div style={infoStyle}>Musteri: {data.customer?.full_name || `${data.customer?.first_name || ""} ${data.customer?.last_name || ""}`.trim() || "Profil yok"}</div>
                    <div style={infoStyle}>TC: {data.customer?.national_id || "-"}</div>
                    <div style={infoStyle}>Tel: {data.customer?.phone || "-"}</div>
                    {(data.accounts || []).length === 0 ? <Empty message="Hesap yok." /> : data.accounts.map((account) => (
                        <div key={account.account_id} style={infoStyle}>
                            <strong>{account.account_number}</strong>
                            <span>{account.account_type} - {account.currency} - {account.status}</span>
                        </div>
                    ))}
                </div>
            )}
        </Panel>
    );
}

function Panel({ title, subtitle, children }) {
    return <div style={panelStyle}><div style={{ marginBottom: 14 }}><div style={{ fontSize: 18, fontWeight: 800 }}>{title}</div><div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{subtitle}</div></div>{children}</div>;
}
function MetricCard({ icon, label, value, tone }) { return <div style={panelStyle}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{label}</span><div style={iconBox(`${tone}18`, tone)}>{icon}</div></div><div style={{ fontSize: 30, fontWeight: 900 }}>{value}</div></div>; }
function QueueCard({ icon, label, value, tone }) { return <div style={{ ...panelStyle, background: "var(--bg-secondary)" }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><span style={{ fontWeight: 700 }}>{label}</span><div style={iconBox(`${tone}18`, tone)}>{icon}</div></div><div style={{ fontSize: 28, fontWeight: 900 }}>{formatNumber(value)}</div></div>; }
function Status({ active, children }) { return <span style={{ display: "inline-flex", padding: "6px 10px", borderRadius: 999, background: active ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)", color: active ? "#10b981" : "#ef4444", fontWeight: 700, fontSize: 12 }}>{children}</span>; }
function Empty({ message }) { return <div style={{ padding: 18, borderRadius: 16, background: "var(--bg-secondary)", color: "var(--text-secondary)", textAlign: "center" }}>{message}</div>; }
function LoadingState({ compact = false }) { return <div style={{ minHeight: compact ? 120 : 260, display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 size={compact ? 22 : 34} style={{ animation: "spin 1s linear infinite" }} /><style>{"@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }"}</style></div>; }
function formatNumber(value) { return new Intl.NumberFormat("tr-TR").format(Number(value || 0)); }
function formatMoney(value) { return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(Number(value || 0)); }
function formatDate(value) { return value ? new Date(value).toLocaleDateString("tr-TR") : "-"; }
function formatDateTime(value) { return value ? new Date(value).toLocaleString("tr-TR") : "-"; }
function iconBox(background, color) { return { width: 40, height: 40, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background, color }; }
function tabButtonStyle(active) { return { border: "none", borderRadius: 999, padding: "10px 16px", cursor: "pointer", fontWeight: 700, background: active ? "linear-gradient(135deg, #111827, #2563eb)" : "var(--bg-secondary)", color: active ? "#fff" : "var(--text-secondary)", transition: "all 0.2s ease" }; }
function filterButtonStyle(active) { return { border: "1px solid var(--border-color)", borderRadius: 999, padding: "8px 12px", cursor: "pointer", fontWeight: 700, background: active ? "rgba(37,99,235,0.12)" : "var(--bg-secondary)", color: active ? "#2563eb" : "var(--text-secondary)", transition: "all 0.2s ease" }; }
const panelStyle = { background: "var(--bg-card)", borderRadius: 20, border: "1px solid var(--border-color)", padding: 18, transition: "all 0.2s ease" };
const rowStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", marginBottom: 10, transition: "transform 0.2s ease" };
const infoStyle = { padding: 14, borderRadius: 16, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", display: "grid", gap: 6 };
const messageStyle = (highlight) => ({ padding: 14, borderRadius: 16, border: highlight ? "1px solid rgba(245,158,11,0.35)" : "1px solid var(--border-color)", background: highlight ? "rgba(245,158,11,0.05)" : "var(--bg-secondary)", marginBottom: 10, transition: "all 0.2s ease" });
const secondaryButtonStyle = { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontWeight: 700, cursor: "pointer", transition: "all 0.2s ease" };
const successButtonStyle = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #10b981, #34d399)", color: "#fff", fontWeight: 700, cursor: "pointer", transition: "all 0.2s ease" };
const dangerButtonStyle = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #ef4444, #f87171)", color: "#fff", fontWeight: 700, cursor: "pointer", transition: "all 0.2s ease" };
const dangerGhostStyle = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 12, border: "1px solid rgba(239,68,68,0.18)", background: "rgba(239,68,68,0.08)", color: "#ef4444", fontWeight: 700, cursor: "pointer", transition: "all 0.2s ease" };
const tableHeadStyle = { padding: "12px 14px", textAlign: "left", fontSize: 12, color: "var(--text-secondary)", fontWeight: 700 };
const tableCellStyle = { padding: "14px", fontSize: 13, verticalAlign: "top" };
const inputStyle = { padding: "8px 14px", borderRadius: 12, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)", outline: "none", transition: "border-color 0.2s ease" };
const selectStyle = { borderRadius: 10, border: "1px solid var(--border-color)", padding: "8px 10px", background: "var(--bg-secondary)", color: "var(--text-primary)", outline: "none" };
