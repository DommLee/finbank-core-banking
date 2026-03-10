import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Users, Activity, BarChart3, DollarSign, FileText, Loader2 } from "lucide-react";
import { analyticsApi } from "../../services/api";

export default function CEOReportsPage() {
    const [report, setReport] = useState(null);
    const [overview, setOverview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    useEffect(() => {
        const fetch = async () => {
            setLoading(true);
            try {
                const [reportRes, overviewRes] = await Promise.all([
                    analyticsApi.monthlyReport({ year: selectedYear, month: selectedMonth }),
                    analyticsApi.overview(),
                ]);
                setReport(reportRes.data);
                setOverview(overviewRes.data);
            } catch { /* */ }
            setLoading(false);
        };
        fetch();
    }, [selectedMonth, selectedYear]);

    const fmt = (n) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n || 0);
    const fmtN = (n) => new Intl.NumberFormat("tr-TR").format(n || 0);

    if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} /></div>;

    const months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

    return (
        <div style={{ padding: "24px", maxWidth: 1000, margin: "0 auto" }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
                <FileText size={28} color="#d4af37" /> CEO Raporları
            </h1>

            {/* Period Selector */}
            <div style={{ display: "flex", gap: 10, marginBottom: 28, flexWrap: "wrap" }}>
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} style={selectStyle}>
                    {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
                <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} style={selectStyle}>
                    {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>

            {/* Overview Stats */}
            {overview && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 28 }}>
                    {[
                        { label: "Toplam Kullanıcı", val: fmtN(overview.total_users), icon: <Users size={22} />, color: "#6366f1" },
                        { label: "Aktif Kullanıcı", val: fmtN(overview.active_users), icon: <Activity size={22} />, color: "#22c55e" },
                        { label: "Toplam Hesap", val: fmtN(overview.total_accounts), icon: <DollarSign size={22} />, color: "#3b82f6" },
                        { label: "Toplam İşlem", val: fmtN(overview.total_transactions), icon: <BarChart3 size={22} />, color: "#f59e0b" },
                    ].map((s, i) => (
                        <div key={i} style={{ background: "var(--bg-card)", borderRadius: 16, padding: 20, border: "1px solid var(--border-color)" }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${s.color}18`, display: "flex", alignItems: "center", justifyContent: "center", color: s.color, marginBottom: 10 }}>{s.icon}</div>
                            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{s.label}</div>
                            <div style={{ fontSize: 22, fontWeight: 800 }}>{s.val}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Monthly Report */}
            {report && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                    {/* Deposits */}
                    <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 24, border: "1px solid var(--border-color)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(34,197,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <TrendingUp size={22} color="#22c55e" />
                            </div>
                            <div>
                                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Toplam Yatırım</div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: "#22c55e" }}>{fmt(report.total_deposits)}</div>
                            </div>
                        </div>
                        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{fmtN(report.deposit_count)} işlem</div>
                    </div>

                    {/* Withdrawals */}
                    <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 24, border: "1px solid var(--border-color)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <TrendingDown size={22} color="#ef4444" />
                            </div>
                            <div>
                                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Toplam Çekim</div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: "#ef4444" }}>{fmt(report.total_withdrawals)}</div>
                            </div>
                        </div>
                        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{fmtN(report.withdrawal_count)} işlem</div>
                    </div>

                    {/* Net Flow */}
                    <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 24, border: "1px solid var(--border-color)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(99,102,241,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <BarChart3 size={22} color="#6366f1" />
                            </div>
                            <div>
                                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Net Akış</div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: report.net_flow >= 0 ? "#22c55e" : "#ef4444" }}>
                                    {report.net_flow >= 0 ? "+" : ""}{fmt(report.net_flow)}
                                </div>
                            </div>
                        </div>
                        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                            {months[selectedMonth - 1]} {selectedYear}
                        </div>
                    </div>

                    {/* Growth */}
                    <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 24, border: "1px solid var(--border-color)" }}>
                        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>📈 Büyüme</h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Yeni Kullanıcılar</span>
                                <span style={{ fontWeight: 700, color: "#22c55e" }}>+{fmtN(report.new_users)}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Yeni Hesaplar</span>
                                <span style={{ fontWeight: 700, color: "#3b82f6" }}>+{fmtN(report.new_accounts)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

const selectStyle = {
    padding: "10px 16px", borderRadius: 12, border: "1px solid var(--border-color)",
    background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 14, cursor: "pointer",
};
