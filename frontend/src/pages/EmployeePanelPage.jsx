import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
    Briefcase,
    CheckCircle,
    Clock,
    Eye,
    Landmark,
    Loader2,
    MessageSquare,
    RefreshCw,
    Search,
    Send,
    ShieldCheck,
    UserRound,
    XCircle,
    FileText,
} from "lucide-react";
import { employeeApi, messagesApi } from "../services/api";

const CUSTOMER_PAGE_SIZE = 12;

export default function EmployeePanelPage() {
    const [tab, setTab] = useState("overview");
    const [dashboard, setDashboard] = useState(null);
    const [pendingKyc, setPendingKyc] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [customerTotal, setCustomerTotal] = useState(0);
    const [messages, setMessages] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    const [searchQ, setSearchQ] = useState("");
    const [page, setPage] = useState(1);
    const [notes, setNotes] = useState({});
    const [replies, setReplies] = useState({});
    const [busyKey, setBusyKey] = useState("");

    useEffect(() => {
        if (tab === "overview") loadOverview();
        if (tab === "kyc") loadPendingKyc();
        if (tab === "customers") loadCustomers();
        if (tab === "messages") loadMessages();
    }, [tab, page]);

    const loadOverview = async () => {
        setLoading(true);
        try {
            const [dashboardRes, kycRes, customerRes, messageRes] = await Promise.all([
                employeeApi.dashboard(),
                employeeApi.pendingKYC(),
                employeeApi.searchCustomers({ page: 1, limit: 8 }),
                messagesApi.inbox(),
            ]);
            setDashboard(dashboardRes.data);
            setPendingKyc(kycRes.data || []);
            setCustomers(customerRes.data?.data || []);
            setCustomerTotal(customerRes.data?.total || 0);
            setMessages(messageRes.data || []);
        } catch {
            toast.error("Employee dashboard verileri yuklenemedi.");
        } finally {
            setLoading(false);
        }
    };

    const loadPendingKyc = async () => {
        setLoading(true);
        try {
            const res = await employeeApi.pendingKYC();
            setPendingKyc(res.data || []);
        } catch {
            toast.error("KYC kuyrugu yuklenemedi.");
        } finally {
            setLoading(false);
        }
    };

    const loadCustomers = async () => {
        setLoading(true);
        try {
            const res = await employeeApi.searchCustomers({ q: searchQ || undefined, page, limit: CUSTOMER_PAGE_SIZE });
            setCustomers(res.data?.data || []);
            setCustomerTotal(res.data?.total || 0);
        } catch {
            toast.error("Musteri listesi yuklenemedi.");
        } finally {
            setLoading(false);
        }
    };

    const loadMessages = async () => {
        setLoading(true);
        try {
            const res = await messagesApi.inbox();
            setMessages(res.data || []);
        } catch {
            toast.error("Mesaj listesi yuklenemedi.");
        } finally {
            setLoading(false);
        }
    };

    const openCustomer = async (customerId) => {
        setDetailLoading(true);
        try {
            const res = await employeeApi.getCustomer(customerId);
            setSelectedCustomer(res.data);
        } catch {
            toast.error("Musteri detayi yuklenemedi.");
        } finally {
            setDetailLoading(false);
        }
    };

    const handleKycDecision = async (customerId, decision) => {
        setBusyKey(`kyc-${customerId}-${decision}`);
        try {
            await employeeApi.kycDecision(customerId, { decision, notes: notes[customerId] || undefined });
            toast.success(decision === "approved" ? "KYC onaylandi." : "KYC reddedildi.");
            loadPendingKyc();
            if (tab === "overview") loadOverview();
            if (selectedCustomer?.customer?.customer_id === customerId) openCustomer(customerId);
        } catch (error) {
            toast.error(error.response?.data?.detail || "KYC karari gonderilemedi.");
        } finally {
            setBusyKey("");
        }
    };

    const handleReply = async (messageId) => {
        const replyBody = replies[messageId];
        if (!replyBody?.trim()) {
            toast.error("Yaniti bos gonderemezsiniz.");
            return;
        }
        setBusyKey(`reply-${messageId}`);
        try {
            await messagesApi.reply(messageId, { reply_body: replyBody.trim() });
            toast.success("Yanit gonderildi.");
            setReplies((current) => ({ ...current, [messageId]: "" }));
            loadMessages();
        } catch {
            toast.error("Yanit gonderilemedi.");
        } finally {
            setBusyKey("");
        }
    };

    const totalPages = Math.max(1, Math.ceil(Number(customerTotal || 0) / CUSTOMER_PAGE_SIZE));

    return (
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                        <div style={iconBox("rgba(37,99,235,0.12)", "#2563eb")}><Briefcase size={22} /></div>
                        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900 }}>Employee dashboard</h1>
                    </div>
                    <p style={{ margin: 0, color: "var(--text-secondary)" }}>KYC kuyrugu, musteri arama ve mesaj cevaplarini tek panelden yonetin.</p>
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => toast.success("Rapor disari aktariliyor... (Mock)")} style={secondaryButtonStyle}>
                        <FileText size={16} /> Rapor Al
                    </button>
                    <button type="button" onClick={() => { if (tab === "overview") loadOverview(); if (tab === "kyc") loadPendingKyc(); if (tab === "customers") loadCustomers(); if (tab === "messages") loadMessages(); }} style={secondaryButtonStyle}>
                        <RefreshCw size={16} /> Yenile
                    </button>
                </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                {[
                    { id: "overview", label: "Overview" },
                    { id: "kyc", label: "KYC" },
                    { id: "customers", label: "Customers" },
                    { id: "messages", label: "Messages" },
                ].map((item) => (
                    <button key={item.id} type="button" onClick={() => setTab(item.id)} style={tabButtonStyle(tab === item.id)}>{item.label}</button>
                ))}
            </div>

            {loading ? <LoadingState /> : null}

            {!loading && tab === "overview" ? (
                <div style={{ display: "grid", gap: 16 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
                        <MetricCard icon={<Clock size={18} />} label="Bekleyen KYC" value={formatNumber(dashboard?.pending_kyc)} tone="#f59e0b" />
                        <MetricCard icon={<UserRound size={18} />} label="Toplam musteri" value={formatNumber(dashboard?.total_customers)} tone="#2563eb" />
                        <MetricCard icon={<MessageSquare size={18} />} label="Acik mesaj" value={formatNumber(dashboard?.open_messages)} tone="#ef4444" />
                        <MetricCard icon={<Landmark size={18} />} label="Bugunku islem" value={formatNumber(dashboard?.today_transactions)} tone="#10b981" />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <Panel title="KYC oncelik kuyugu" subtitle="Bekleyen dosyalari hizli ele alin">
                            {pendingKyc.length === 0 ? <Empty message="Bekleyen KYC yok." /> : pendingKyc.slice(0, 5).map((customer) => (
                                <div key={customer.customer_id} style={rowStyle}>
                                    <div>
                                        <div style={{ fontWeight: 700 }}>{customer.first_name} {customer.last_name}</div>
                                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{customer.user?.email || customer.phone || "-"}</div>
                                    </div>
                                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                        <button type="button" onClick={() => openCustomer(customer.customer_id)} style={secondaryButtonStyle}><Eye size={14} /> Detay</button>
                                        <button type="button" onClick={() => handleKycDecision(customer.customer_id, "approved")} disabled={busyKey === `kyc-${customer.customer_id}-approved`} style={successButtonStyle}><CheckCircle size={14} /> Onay</button>
                                        <button type="button" onClick={() => handleKycDecision(customer.customer_id, "rejected")} disabled={busyKey === `kyc-${customer.customer_id}-rejected`} style={dangerButtonStyle}><XCircle size={14} /> Red</button>
                                    </div>
                                </div>
                            ))}
                        </Panel>

                        <Panel title="Mesajlar" subtitle="Musteri yaniti bekleyen basliklar">
                            {messages.length === 0 ? <Empty message="Mesaj yok." /> : messages.slice(0, 5).map((message) => (
                                <div key={message.message_id} style={messageStyle(message.status === "open")}>
                                    <div style={{ fontWeight: 700, marginBottom: 6 }}>{message.subject}</div>
                                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>{message.sender_email}</div>
                                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{formatDateTime(message.created_at)}</div>
                                </div>
                            ))}
                        </Panel>
                    </div>
                </div>
            ) : null}

            {!loading && tab === "kyc" ? (
                <Panel title="KYC kuyrugu" subtitle="Karar notu ile birlikte onay veya red verin">
                    {pendingKyc.length === 0 ? <Empty message="Bekleyen KYC kaydi yok." /> : pendingKyc.map((customer) => (
                        <div key={customer.customer_id} style={cardStyle}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                                <div>
                                    <div style={{ fontWeight: 700 }}>{customer.first_name} {customer.last_name}</div>
                                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>TC: {customer.national_id} - Tel: {customer.phone}</div>
                                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{customer.user?.email || "-"}</div>
                                </div>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    <button type="button" onClick={() => toast.success("Belgeler aciliyor... (Mock)")} style={secondaryButtonStyle}><Eye size={14} /> Belgeler</button>
                                    <button type="button" onClick={() => openCustomer(customer.customer_id)} style={secondaryButtonStyle}><UserRound size={14} /> Detay</button>
                                </div>
                            </div>
                            <textarea value={notes[customer.customer_id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [customer.customer_id]: event.target.value }))} placeholder="Karar notu (opsiyonel)" style={textAreaStyle} />
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                                <button type="button" onClick={() => handleKycDecision(customer.customer_id, "approved")} disabled={busyKey === `kyc-${customer.customer_id}-approved`} style={successButtonStyle}><CheckCircle size={14} /> Onayla</button>
                                <button type="button" onClick={() => handleKycDecision(customer.customer_id, "rejected")} disabled={busyKey === `kyc-${customer.customer_id}-rejected`} style={dangerButtonStyle}><XCircle size={14} /> Reddet</button>
                            </div>
                        </div>
                    ))}
                </Panel>
            ) : null}

            {!loading && tab === "customers" ? (
                <div style={{ display: "grid", gridTemplateColumns: selectedCustomer ? "1.1fr 0.9fr" : "1fr", gap: 16 }}>
                    <Panel title="Musteri arama" subtitle="Hesap, profil ve hareket gecmisine hizli erisin">
                        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                            <input value={searchQ} onChange={(event) => setSearchQ(event.target.value)} placeholder="Isim, soyisim veya TC ara" style={{ ...inputStyle, flex: 1 }} />
                            <button type="button" onClick={() => { setPage(1); loadCustomers(); }} style={secondaryButtonStyle}><Search size={14} /> Ara</button>
                        </div>
                        {(customers || []).length === 0 ? <Empty message="Sonuc bulunamadi." /> : customers.map((customer) => (
                            <div key={customer.customer_id} style={rowStyle}>
                                <div>
                                    <div style={{ fontWeight: 700 }}>{customer.full_name || `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "-"}</div>
                                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{customer.national_id || "-"} - {customer.status || "-"}</div>
                                </div>
                                <button type="button" onClick={() => openCustomer(customer.customer_id)} style={secondaryButtonStyle}><Eye size={14} /> Detay</button>
                            </div>
                        ))}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
                            <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{formatNumber(customerTotal)} kayit - sayfa {page}/{totalPages}</span>
                            <div style={{ display: "flex", gap: 8 }}>
                                <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} style={secondaryButtonStyle}>Geri</button>
                                <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages} style={secondaryButtonStyle}>Ileri</button>
                            </div>
                        </div>
                    </Panel>
                    {selectedCustomer ? <CustomerDetailCard data={selectedCustomer} loading={detailLoading} /> : null}
                </div>
            ) : null}

            {!loading && tab === "messages" ? (
                <Panel title="Mesaj merkezi" subtitle="Musteri sorularina panelden cevap verin">
                    {messages.length === 0 ? <Empty message="Mesaj yok." /> : messages.map((message) => (
                        <div key={message.message_id} style={cardStyle}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                                <strong>{message.subject}</strong>
                                <Status active={message.status !== "open"}>{message.status}</Status>
                            </div>
                            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>{message.body}</div>
                            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>{message.sender_email} - {formatDateTime(message.created_at)}</div>
                            {message.reply ? <div style={{ padding: 10, borderRadius: 12, background: "var(--bg-card)", marginBottom: 10 }}>{message.reply}</div> : null}
                            {message.status === "open" ? (
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    <input value={replies[message.message_id] || ""} onChange={(event) => setReplies((current) => ({ ...current, [message.message_id]: event.target.value }))} placeholder="Yaniti yazin" style={{ ...inputStyle, flex: 1 }} />
                                    <button type="button" onClick={() => handleReply(message.message_id)} disabled={busyKey === `reply-${message.message_id}`} style={successButtonStyle}><Send size={14} /> Gonder</button>
                                </div>
                            ) : null}
                        </div>
                    ))}
                </Panel>
            ) : null}
        </div>
    );
}

function CustomerDetailCard({ data, loading }) {
    return (
        <Panel title="Musteri 360" subtitle="Profil, hesaplar ve son hareketler">
            {loading ? <LoadingState compact /> : (
                <div style={{ display: "grid", gap: 12 }}>
                    <div style={infoStyle}><strong>{data.customer?.full_name || `${data.customer?.first_name || ""} ${data.customer?.last_name || ""}`.trim() || "-"}</strong><span>{data.user?.email || "-"}</span></div>
                    <div style={infoStyle}>Durum: {data.customer?.status || "-"}</div>
                    <div style={infoStyle}>TC: {data.customer?.national_id || "-"}</div>
                    {(data.accounts || []).length === 0 ? <Empty message="Hesap yok." /> : data.accounts.map((account) => (
                        <div key={account.account_id} style={infoStyle}><strong>{account.account_number}</strong><span>{account.account_type} - {account.currency} - {account.status}</span></div>
                    ))}
                    {(data.recent_transactions || []).slice(0, 8).map((tx) => (
                        <div key={tx.entry_id || tx.id} style={infoStyle}><strong>{tx.category || tx.type || "islem"}</strong><span>{formatMoney(tx.amount)} - {formatDateTime(tx.created_at)}</span></div>
                    ))}
                </div>
            )}
        </Panel>
    );
}

function Panel({ title, subtitle, children }) { return <div style={panelStyle}><div style={{ marginBottom: 14 }}><div style={{ fontSize: 18, fontWeight: 800 }}>{title}</div><div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{subtitle}</div></div>{children}</div>; }
function MetricCard({ icon, label, value, tone }) { return <div style={panelStyle}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{label}</span><div style={iconBox(`${tone}18`, tone)}>{icon}</div></div><div style={{ fontSize: 30, fontWeight: 900 }}>{value}</div></div>; }
function Status({ active, children }) { return <span style={{ display: "inline-flex", padding: "6px 10px", borderRadius: 999, background: active ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)", color: active ? "#10b981" : "#ef4444", fontWeight: 700, fontSize: 12 }}>{children}</span>; }
function Empty({ message }) { return <div style={{ padding: 18, borderRadius: 16, background: "var(--bg-secondary)", color: "var(--text-secondary)", textAlign: "center" }}>{message}</div>; }
function LoadingState({ compact = false }) { return <div style={{ minHeight: compact ? 120 : 260, display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 size={compact ? 22 : 34} style={{ animation: "spin 1s linear infinite" }} /><style>{"@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }"}</style></div>; }
function formatNumber(value) { return new Intl.NumberFormat("tr-TR").format(Number(value || 0)); }
function formatMoney(value) { return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(Number(value || 0)); }
function formatDateTime(value) { return value ? new Date(value).toLocaleString("tr-TR") : "-"; }
function iconBox(background, color) { return { width: 40, height: 40, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background, color }; }
function tabButtonStyle(active) { return { border: "none", borderRadius: 999, padding: "10px 16px", cursor: "pointer", fontWeight: 700, background: active ? "linear-gradient(135deg, #111827, #2563eb)" : "var(--bg-secondary)", color: active ? "#fff" : "var(--text-secondary)", transition: "all 0.2s ease" }; }
const panelStyle = { background: "var(--bg-card)", borderRadius: 20, border: "1px solid var(--border-color)", padding: 18, transition: "all 0.2s ease" };
const rowStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", marginBottom: 10, transition: "transform 0.2s ease" };
const cardStyle = { padding: 14, borderRadius: 16, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", marginBottom: 10, transition: "transform 0.2s ease" };
const infoStyle = { padding: 14, borderRadius: 16, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", display: "grid", gap: 6 };
const messageStyle = (highlight) => ({ padding: 14, borderRadius: 16, border: highlight ? "1px solid rgba(245,158,11,0.35)" : "1px solid var(--border-color)", background: highlight ? "rgba(245,158,11,0.05)" : "var(--bg-secondary)", marginBottom: 10, transition: "all 0.2s ease" });
const secondaryButtonStyle = { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontWeight: 700, cursor: "pointer", transition: "all 0.2s ease" };
const successButtonStyle = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #10b981, #34d399)", color: "#fff", fontWeight: 700, cursor: "pointer", transition: "all 0.2s ease" };
const dangerButtonStyle = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #ef4444, #f87171)", color: "#fff", fontWeight: 700, cursor: "pointer", transition: "all 0.2s ease" };
const inputStyle = { padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)", outline: "none", transition: "border-color 0.2s ease" };
const textAreaStyle = { width: "100%", minHeight: 88, resize: "vertical", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", outline: "none", transition: "border-color 0.2s ease" };
