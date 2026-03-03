import { useState, useEffect, useCallback, useRef } from "react";
import { Crown, Users, Activity, MessageSquare, Shield, Trash2, UserCheck, UserX, Download, TrendingUp, DollarSign } from "lucide-react";
import { adminApi } from "../services/api";
import toast from "react-hot-toast";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AdminPanelPage() {
    const [tab, setTab] = useState("stats");
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [userTotal, setUserTotal] = useState(0);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchRole, setSearchRole] = useState("");
    const [page, setPage] = useState(1);
    const pdfRef = useRef(null);

    const fetchStats = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminApi.systemStats();
            setStats(res.data);
        } catch { toast.error("İstatistikler alınamadı") }
        setLoading(false);
    }, []);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page, limit: 15 };
            if (searchRole) params.role = searchRole;
            const res = await adminApi.listUsers(params);
            setUsers(res.data.data);
            setUserTotal(res.data.total);
        } catch { toast.error("Kullanıcılar alınamadı"); }
        setLoading(false);
    }, [page, searchRole]);

    const fetchMessages = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminApi.allMessages({ page: 1, limit: 30 });
            setMessages(res.data.data);
        } catch { toast.error("Mesajlar alınamadı"); }
        setLoading(false);
    }, []);

    useEffect(() => {
        if (tab === "stats") fetchStats();
        else if (tab === "users") fetchUsers();
        else if (tab === "messages") fetchMessages();
    }, [tab, fetchStats, fetchUsers, fetchMessages]);

    const changeRole = async (userId, role) => {
        try { await adminApi.changeRole(userId, { role }); toast.success("Rol güncellendi."); fetchUsers(); } catch { toast.error("Hata."); }
    };

    const toggleStatus = async (userId, active) => {
        try { await adminApi.toggleStatus(userId, { is_active: active }); toast.success(active ? "Aktifleştirildi." : "Devre dışı bırakıldı."); fetchUsers(); } catch { toast.error("Hata."); }
    };

    const deleteUser = async (userId) => {
        if (!window.confirm("Bu kullanıcıyı silmek istediğinize emin misiniz?")) return;
        try { await adminApi.deleteUser(userId); toast.success("Kullanıcı silindi."); fetchUsers(); } catch { toast.error("Hata."); }
    };

    const downloadPDF = async () => {
        const input = pdfRef.current;
        if (!input) return;
        toast.loading("PDF Hazırlanıyor...", { id: "pdf-toast" });
        try {
            const canvas = await html2canvas(input, { scale: 2, useCORS: true, backgroundColor: '#0f172a' });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`FinBank-Rapor-${new Date().toISOString().split('T')[0]}.pdf`);
            toast.success("PDF başarıyla indirildi!", { id: "pdf-toast" });
        } catch (err) {
            console.error(err);
            toast.error("PDF oluşturulurken hata oluştu", { id: "pdf-toast" });
        }
    };

    const fmt = (n) => new Intl.NumberFormat("tr-TR").format(n || 0);
    const fmtCurrency = (n) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "USD" }).format(n || 0);

    const tabs = [
        { id: "stats", label: "Analiz & Raporlar", icon: <Activity size={16} /> },
        { id: "users", label: "Kullanıcı Yönetimi", icon: <Users size={16} /> },
        { id: "messages", label: "Sistem Mesajları", icon: <MessageSquare size={16} /> },
    ];

    return (
        <div style={{ padding: "24px", maxWidth: 1200, margin: "0 auto", animation: "fadeIn 0.4s ease-out" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800, display: "flex", alignItems: "center", gap: 12 }}>
                    <Crown size={32} color="#f59e0b" /> Yönetici & CEO Paneli
                </h1>
                {tab === "stats" && stats && (
                    <button onClick={downloadPDF} style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "10px 20px",
                        background: "linear-gradient(135deg, #10b981, #059669)", color: "white",
                        border: "none", borderRadius: 12, cursor: "pointer", fontWeight: 600,
                        boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)", transition: "all 0.2s"
                    }}>
                        <Download size={18} /> CEO Raporu İndir (PDF)
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 12, marginBottom: 32, overflowX: "auto", paddingBottom: 8 }}>
                {tabs.map((t) => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{
                        padding: "12px 24px", borderRadius: 14, border: "none", cursor: "pointer",
                        background: tab === t.id ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "var(--bg-card)",
                        color: tab === t.id ? "#fff" : "var(--text-secondary)", fontWeight: 600, fontSize: 14,
                        display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s",
                        boxShadow: tab === t.id ? "0 4px 12px rgba(99, 102, 241, 0.3)" : "none"
                    }}>{t.icon} {t.label}</button>
                ))}
            </div>

            {/* Stats Tab */}
            {tab === "stats" && loading && <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Activity className="animate-pulse" size={40} color="#6366f1" /></div>}

            {tab === "stats" && stats && !loading && (
                <div ref={pdfRef} style={{ background: "transparent", padding: "10px" }}>
                    {/* Top KPI Cards */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, marginBottom: 32 }}>
                        {[
                            { label: "Toplam Kullanıcı", val: fmt(stats.total_users), color: "#6366f1", icon: <Users size={24} /> },
                            { label: "Sistemdeki Hesaplar", val: fmt(stats.total_accounts), color: "#8b5cf6", icon: <UserCheck size={24} /> },
                            { label: "Net Likidite", val: fmtCurrency(stats.financials?.net_liquidity), color: "#10b981", icon: <DollarSign size={24} /> },
                            { label: "Toplam Adet (İşlem)", val: fmt(stats.total_transactions), color: "#f59e0b", icon: <TrendingUp size={24} /> },
                        ].map((s, i) => (
                            <div key={i} style={{
                                background: "var(--bg-card)", borderRadius: 20, padding: 24,
                                border: "1px solid var(--border-color)", position: "relative", overflow: "hidden"
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                                    <div style={{ width: 48, height: 48, borderRadius: 14, background: `${s.color}20`, display: "flex", alignItems: "center", justifyContent: "center", color: s.color }}>{s.icon}</div>
                                    <div style={{ fontSize: 14, color: "var(--text-secondary)", fontWeight: 500 }}>{s.label}</div>
                                </div>
                                <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)" }}>{s.val}</div>
                                <div style={{ position: "absolute", bottom: -20, right: -20, opacity: 0.05, transform: "scale(3)" }}>{s.icon}</div>
                            </div>
                        ))}
                    </div>

                    {/* Financial Metrics Row */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32, gridAutoFlow: "dense" }}>
                        <div style={{ background: "var(--bg-card)", borderRadius: 20, border: "1px solid var(--border-color)", padding: 24, minWidth: 0 }}>
                            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}><Activity size={20} color="#3b82f6" /> İşlem Hacmi Trendi (Son 30 Gün)</h3>
                            <div style={{ height: 300, width: "100%" }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={stats.daily_trends || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val / 1000}k`} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: 12, color: 'var(--text-primary)' }}
                                            formatter={(value) => [fmtCurrency(value), 'Hacim']}
                                        />
                                        <Area type="monotone" dataKey="volume" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorVolume)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div style={{ background: "var(--bg-card)", borderRadius: 20, border: "1px solid var(--border-color)", padding: 24, minWidth: 0 }}>
                            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}><Shield size={20} color="#f59e0b" /> Genel Finansal Dağılım</h3>
                            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                {[
                                    { label: "Toplam Gelen (Mevduat)", value: stats.financials?.total_deposits, color: "#10b981", percent: 100 },
                                    { label: "Toplam Giden (Çekim)", value: stats.financials?.total_withdrawals, color: "#ef4444", percent: Math.min((stats.financials?.total_withdrawals / (stats.financials?.total_deposits || 1)) * 100, 100) },
                                    { label: "İç Transferler", value: stats.financials?.total_transfers, color: "#6366f1", percent: Math.min((stats.financials?.total_transfers / (stats.financials?.total_deposits || 1)) * 100, 100) }
                                ].map((item, i) => (
                                    <div key={i}>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                            <span style={{ fontSize: 14, color: "var(--text-secondary)", fontWeight: 500 }}>{item.label}</span>
                                            <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{fmtCurrency(item.value)}</span>
                                        </div>
                                        <div style={{ width: "100%", height: 8, background: "var(--bg-secondary)", borderRadius: 4, overflow: "hidden" }}>
                                            <div style={{ width: `${item.percent}%`, height: "100%", background: item.color, borderRadius: 4, transition: "width 1s ease-out" }} />
                                        </div>
                                    </div>
                                ))}

                                <div style={{ marginTop: 20, padding: 16, background: "rgba(245, 158, 11, 0.1)", borderRadius: 12, border: "1px solid rgba(245, 158, 11, 0.2)" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span style={{ color: "#f59e0b", fontWeight: 600 }}>Cevap Bekleyen KYC Başvuruları</span>
                                        <span style={{ background: "#f59e0b", color: "white", padding: "4px 12px", borderRadius: 20, fontWeight: 800 }}>{stats.pending_kyc} Adet</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Row */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, gridAutoFlow: "dense" }}>
                        <div style={{ background: "var(--bg-card)", borderRadius: 20, border: "1px solid var(--border-color)", padding: 24, display: "flex", flexDirection: "column", minWidth: 0 }}>
                            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>Kullanıcı ve Rol Dağılımı</h3>
                            <div style={{ height: 260, width: "100%" }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={[
                                        { name: "Müşteriler", count: stats.customers },
                                        { name: "Çalışanlar/Admin", count: stats.employees }
                                    ]} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-color)" />
                                        <XAxis type="number" stroke="var(--text-secondary)" fontSize={12} />
                                        <YAxis dataKey="name" type="category" stroke="var(--text-secondary)" fontSize={13} width={120} />
                                        <Tooltip cursor={{ fill: 'var(--bg-secondary)' }} contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: 12 }} />
                                        <Bar dataKey="count" fill="#8b5cf6" radius={[0, 8, 8, 0]} barSize={40}>
                                            {[0, 1].map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div style={{ background: "var(--bg-card)", borderRadius: 20, border: "1px solid var(--border-color)", padding: 24, display: "flex", flexDirection: "column", minWidth: 0 }}>
                            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>Açık Hesap Tipleri</h3>
                            <div style={{ height: 260, width: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}>
                                {(!stats.account_types || stats.account_types.length === 0) ? (
                                    <p style={{ color: "var(--text-secondary)" }}>Yeterli veri yok.</p>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={stats.account_types}
                                                cx="50%" cy="50%"
                                                innerRadius={60} outerRadius={90}
                                                paddingAngle={5}
                                                dataKey="value"
                                                nameKey="name"
                                                stroke="none"
                                            >
                                                {stats.account_types.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(value) => [value, 'Adet']} contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: 12 }} />
                                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                        </PieChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Users Tab */}
            {tab === "users" && (
                <div style={{ animation: "fadeIn 0.3s ease-out" }}>
                    <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                        {["", "customer", "employee", "admin", "ceo"].map((r) => (
                            <button key={r} onClick={() => { setSearchRole(r); setPage(1); }} style={{
                                padding: "8px 18px", borderRadius: 10, border: "1px solid var(--border-color)", cursor: "pointer", fontSize: 13, fontWeight: 500, transition: "all 0.2s",
                                background: searchRole === r ? "#6366f1" : "var(--bg-card)", color: searchRole === r ? "#fff" : "var(--text-secondary)",
                            }}>{r ? r.charAt(0).toUpperCase() + r.slice(1) : "Tüm Kullanıcılar"}</button>
                        ))}
                    </div>
                    {loading ? <div style={{ padding: 40, textAlign: "center" }}><Loader2 size={32} className="animate-spin" color="#6366f1" /></div> : (
                        <div style={{ overflowX: "auto", background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border-color)" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ borderBottom: "1px solid var(--border-color)", background: "var(--bg-secondary)" }}>
                                        {["Kullanıcı ID / E-posta", "Rol", "Durum", "Kayıt Tarihi", "İşlemler"].map((h) => (
                                            <th key={h} style={{ padding: "16px 20px", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textAlign: "left" }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((u) => (
                                        <tr key={u.user_id} style={{ borderBottom: "1px solid var(--border-color)", transition: "background 0.2s" }} className="hover-row">
                                            <td style={{ padding: "16px 20px" }}>
                                                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{u.email}</div>
                                                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4, fontFamily: "monospace" }}>{u.user_id}</div>
                                            </td>
                                            <td style={{ padding: "16px 20px" }}>
                                                <select value={u.role} onChange={(e) => changeRole(u.user_id, e.target.value)}
                                                    style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13, cursor: "pointer", outline: "none" }}>
                                                    {["customer", "employee", "admin", "ceo"].map((r) => <option key={r} value={r}>{r}</option>)}
                                                </select>
                                            </td>
                                            <td style={{ padding: "16px 20px" }}>
                                                <span style={{
                                                    padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                                                    background: u.is_active ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                                                    color: u.is_active ? "#22c55e" : "#ef4444",
                                                }}>{u.is_active ? "🟢 Aktif" : "🔴 Pasif"}</span>
                                            </td>
                                            <td style={{ padding: "16px 20px", fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>
                                                {new Date(u.created_at).toLocaleDateString("tr-TR")}
                                            </td>
                                            <td style={{ padding: "16px 20px", display: "flex", gap: 10 }}>
                                                <button onClick={() => toggleStatus(u.user_id, !u.is_active)} style={{
                                                    padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, transition: "opacity 0.2s",
                                                    background: u.is_active ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
                                                    color: u.is_active ? "#ef4444" : "#22c55e",
                                                }}>{u.is_active ? "Devre Dışı Bırak" : "Aktifleştir"}</button>
                                                <button onClick={() => deleteUser(u.user_id)} style={{
                                                    padding: "8px", borderRadius: 8, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                                                    background: "rgba(239,68,68,0.1)", color: "#ef4444", transition: "all 0.2s"
                                                }} title="Sil"><Trash2 size={16} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {userTotal > 15 && (
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderTop: "1px solid var(--border-color)" }}>
                                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Toplam <strong>{userTotal}</strong> kullanıcı, Sayfa {page}</span>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <button disabled={page <= 1} onClick={() => setPage(page - 1)} style={pgBtn}>En Yeni ←</button>
                                        <button disabled={page * 15 >= userTotal} onClick={() => setPage(page + 1)} style={pgBtn}>Daha Eski →</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Messages Tab */}
            {tab === "messages" && (
                <div style={{ display: "grid", gap: 16, animation: "fadeIn 0.3s ease-out" }}>
                    {loading ? <div style={{ padding: 40, textAlign: "center" }}><Loader2 size={32} className="animate-spin" color="#6366f1" /></div> : messages.length === 0 ? <p style={{ textAlign: "center", color: "var(--text-secondary)", padding: 40, fontSize: 15 }}>Cevaplanmamış veya gösterilecek mesaj yok.</p> :
                        messages.map((m) => (
                            <div key={m.message_id} style={{
                                background: "var(--bg-card)", borderRadius: 16, padding: 20,
                                border: `1px solid ${m.status === "open" ? "rgba(245,158,11,0.5)" : "var(--border-color)"}`,
                                position: "relative", overflow: "hidden"
                            }}>
                                {m.status === "open" && <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: "#f59e0b" }} />}
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, alignItems: "center" }}>
                                    <span style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>{m.subject}</span>
                                    <span style={{
                                        padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                                        background: m.status === "open" ? "rgba(245,158,11,0.15)" : "rgba(34,197,94,0.15)",
                                        color: m.status === "open" ? "#f59e0b" : "#22c55e",
                                    }}>{m.status === "open" ? "Açık - Bekliyor" : "Yanıtlandı"}</span>
                                </div>
                                <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.5 }}>{m.body}</p>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px dashed var(--border-color)", paddingTop: 12 }}>
                                    <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>Gönderen: <span style={{ color: "var(--text-primary)" }}>{m.sender_email}</span></span>
                                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{new Date(m.created_at).toLocaleString("tr-TR")}</span>
                                </div>
                            </div>
                        ))
                    }
                </div>
            )}
            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .hover-row:hover { background: var(--bg-secondary) !important; }
            `}</style>
        </div>
    );
}

const pgBtn = { padding: "8px 16px", borderRadius: 10, border: "1px solid var(--border-color)", cursor: "pointer", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13, fontWeight: 600, transition: "background 0.2s" };
