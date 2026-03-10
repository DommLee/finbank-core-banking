import { useState, useEffect, useCallback } from "react";
import { Target, Plus, Trash2, ArrowRight, Loader2 } from "lucide-react";
import { goalsApi, accountApi } from "../services/api";
import toast from "react-hot-toast";

export default function SavingsGoalsPage() {
    const [goals, setGoals] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ name: "", target_amount: "", deadline: "" });
    const [contributeForm, setContributeForm] = useState({ goal_id: null, account_id: "", amount: "" });

    const fetchData = useCallback(async () => {
        try {
            const [goalsRes, accRes] = await Promise.all([goalsApi.list(), accountApi.listMine()]);
            setGoals(goalsRes.data);
            setAccounts(accRes.data.filter((a) => a.status === "active"));
        } catch { toast.error("Veriler yüklenemedi."); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.name || !form.target_amount) return toast.error("İsim ve hedef tutar gerekli.");
        try {
            await goalsApi.create({ ...form, target_amount: parseFloat(form.target_amount) });
            toast.success("Hedef oluşturuldu! 🎯");
            setForm({ name: "", target_amount: "", deadline: "" });
            setShowCreate(false);
            fetchData();
        } catch (err) { toast.error(err.response?.data?.detail || "Hata oluştu."); }
    };

    const handleContribute = async (e) => {
        e.preventDefault();
        if (!contributeForm.account_id || !contributeForm.amount) return toast.error("Hesap ve tutar seçin.");
        try {
            await goalsApi.contribute(contributeForm.goal_id, {
                account_id: contributeForm.account_id,
                amount: parseFloat(contributeForm.amount),
            });
            toast.success("Para eklendi! 💰");
            setContributeForm({ goal_id: null, account_id: "", amount: "" });
            fetchData();
        } catch (err) { toast.error(err.response?.data?.detail || "Hata oluştu."); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Bu hedefi silmek istediğinize emin misiniz?")) return;
        try { await goalsApi.delete(id); toast.success("Hedef silindi."); fetchData(); }
        catch { toast.error("Silinemedi."); }
    };

    const fmt = (n) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n || 0);

    if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} /></div>;

    return (
        <div style={{ padding: "24px", maxWidth: 900, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
                    <Target size={28} color="#f59e0b" /> Tasarruf Hedefleri
                </h1>
                <button onClick={() => setShowCreate(!showCreate)} style={{
                    padding: "10px 20px", borderRadius: 12, border: "none", cursor: "pointer",
                    background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff", fontWeight: 600,
                    display: "flex", alignItems: "center", gap: 6, fontSize: 14,
                }}>
                    <Plus size={18} /> Yeni Hedef
                </button>
            </div>

            {/* Create Form */}
            {showCreate && (
                <form onSubmit={handleCreate} style={{
                    background: "var(--bg-card)", borderRadius: 16, padding: 24, marginBottom: 24,
                    border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: 14,
                }}>
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Hedef adı (örn: Tatil fonu)" style={inputStyle} />
                    <input type="number" value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })}
                        placeholder="Hedef tutar (₺)" style={inputStyle} />
                    <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                        style={inputStyle} />
                    <button type="submit" style={{ ...btnStyle, background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
                        Oluştur
                    </button>
                </form>
            )}

            {/* Goals List */}
            {goals.length === 0 ? (
                <div style={{ textAlign: "center", padding: 60, color: "var(--text-secondary)" }}>
                    <Target size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                    <p>Henüz hedef yok. İlk hedefinizi oluşturun!</p>
                </div>
            ) : (
                <div style={{ display: "grid", gap: 16 }}>
                    {goals.map((g) => {
                        const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100));
                        const isComplete = g.status === "completed";
                        return (
                            <div key={g.goal_id} style={{
                                background: "var(--bg-card)", borderRadius: 16, padding: 24,
                                border: isComplete ? "2px solid #22c55e" : "1px solid var(--border-color)",
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                    <h3 style={{ fontSize: 18, fontWeight: 600 }}>{isComplete ? "✅ " : "🎯 "}{g.name}</h3>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        {!isComplete && (
                                            <button onClick={() => setContributeForm({ ...contributeForm, goal_id: g.goal_id })}
                                                style={{ ...smallBtn, background: "#6366f1" }}>
                                                <Plus size={14} /> Para Ekle
                                            </button>
                                        )}
                                        <button onClick={() => handleDelete(g.goal_id)} style={{ ...smallBtn, background: "#ef4444" }}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>
                                    <span>{fmt(g.current_amount)} / {fmt(g.target_amount)}</span>
                                    <span style={{ fontWeight: 700, color: isComplete ? "#22c55e" : "#f59e0b" }}>{pct}%</span>
                                </div>
                                {/* Progress bar */}
                                <div style={{ height: 10, borderRadius: 5, background: "var(--bg-secondary)", overflow: "hidden" }}>
                                    <div style={{
                                        height: "100%", borderRadius: 5, transition: "width 0.5s ease",
                                        width: `${pct}%`,
                                        background: isComplete ? "linear-gradient(90deg, #22c55e, #16a34a)" : "linear-gradient(90deg, #f59e0b, #d97706)",
                                    }} />
                                </div>
                                {g.deadline && <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>📅 Hedef: {g.deadline}</p>}

                                {/* Contribute form */}
                                {contributeForm.goal_id === g.goal_id && (
                                    <form onSubmit={handleContribute} style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                                        <select value={contributeForm.account_id} onChange={(e) => setContributeForm({ ...contributeForm, account_id: e.target.value })}
                                            style={{ ...inputStyle, flex: 1, minWidth: 150 }}>
                                            <option value="">Hesap seçin</option>
                                            {accounts.map((a) => <option key={a.account_id} value={a.account_id}>{a.account_number} ({fmt(a.balance)})</option>)}
                                        </select>
                                        <input type="number" value={contributeForm.amount} onChange={(e) => setContributeForm({ ...contributeForm, amount: e.target.value })}
                                            placeholder="Tutar (₺)" style={{ ...inputStyle, width: 120 }} />
                                        <button type="submit" style={{ ...smallBtn, background: "#22c55e", padding: "8px 16px" }}>
                                            <ArrowRight size={16} /> Gönder
                                        </button>
                                    </form>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

const inputStyle = {
    padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border-color)",
    background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14, outline: "none",
};
const btnStyle = {
    padding: "12px 20px", borderRadius: 12, border: "none", color: "#fff",
    fontWeight: 600, cursor: "pointer", fontSize: 14,
};
const smallBtn = {
    padding: "6px 12px", borderRadius: 8, border: "none", color: "#fff",
    cursor: "pointer", fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", gap: 4,
};
