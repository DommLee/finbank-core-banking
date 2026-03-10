import { useEffect, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Users, Plus, X, Check, RefreshCw } from "lucide-react";
import { ledgerApi, paymentRequestsApi } from "../services/api";
import { toast } from "react-hot-toast";

const CATEGORY_LABELS = {
    DEPOSIT: "Para yatirma",
    WITHDRAWAL: "Para cekme",
    TRANSFER_IN: "Gelen transfer",
    TRANSFER_OUT: "Giden transfer",
    BILL_PAYMENT: "Fatura odeme",
    CARD_PAYMENT: "Kart odemesi",
    GOAL_CONTRIBUTION: "Hedef birikim",
};

const CATEGORY_EMOJIS = {
    DEPOSIT: "[+]",
    WITHDRAWAL: "[-]",
    TRANSFER_IN: "[IN]",
    TRANSFER_OUT: "[OUT]",
    BILL_PAYMENT: "[BILL]",
    CARD_PAYMENT: "[CARD]",
    GOAL_CONTRIBUTION: "[SAVE]",
};

export default function LedgerPage() {
    const [entries, setEntries] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [skip, setSkip] = useState(0);
    const limit = 20;

    // Split Bill State
    const [splitModal, setSplitModal] = useState({ show: false, entry: null });
    const [splitTargets, setSplitTargets] = useState([{ alias: "", amount: "" }]);
    const [splitLoading, setSplitLoading] = useState(false);

    useEffect(() => {
        loadEntries();
    }, [skip]);

    const loadEntries = async () => {
        setLoading(true);
        try {
            const res = await ledgerApi.getEntries({ skip, limit });
            setEntries(Array.isArray(res.data?.entries) ? res.data.entries : []);
            setTotal(Number(res.data?.total || 0));
        } catch (error) {
            setEntries([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    };

    const handleSplitSubmit = async (e) => {
        e.preventDefault();
        const validTargets = splitTargets.filter(t => t.alias && Number(t.amount) > 0);

        if (validTargets.length === 0) {
            toast.error("Lütfen en az bir kişi ve geçerli bir tutar girin.");
            return;
        }

        setSplitLoading(true);
        try {
            const promises = validTargets.map(t =>
                paymentRequestsApi.create({
                    target_alias: t.alias,
                    amount: Number(t.amount),
                    description: `Hesap Bölüştürme: ${splitModal.entry.description || CATEGORY_LABELS[splitModal.entry.category]}`
                })
            );

            await Promise.all(promises);
            toast.success("Hesap bölüştürme istekleri gönderildi.");
            setSplitModal({ show: false, entry: null });
            setSplitTargets([{ alias: "", amount: "" }]);
        } catch (error) {
            toast.error("İstek gönderilirken hata oluştu. Bazı kişiler bulunamamış olabilir.");
        } finally {
            setSplitLoading(false);
        }
    };

    const addSplitTarget = () => {
        setSplitTargets([...splitTargets, { alias: "", amount: "" }]);
    };

    const removeSplitTarget = (index) => {
        const newTargets = [...splitTargets];
        newTargets.splice(index, 1);
        setSplitTargets(newTargets.length ? newTargets : [{ alias: "", amount: "" }]);
    };

    const splitEqually = () => {
        if (!splitModal.entry) return;
        const totalAmount = Number(splitModal.entry.amount);
        const count = splitTargets.length + 1; // +1 for the current user
        const equalAmount = (totalAmount / count).toFixed(2);

        const newTargets = splitTargets.map(t => ({ ...t, amount: equalAmount }));
        setSplitTargets(newTargets);
    };

    if (loading && entries.length === 0) {
        return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}><div className="spinner" /></div>;
    }

    return (
        <div>
            <div className="page-header">
                <h1>Hesap defteri</h1>
                <p>Tum finansal hareketlerin kaydi. Toplam {total} islem listeleniyor.</p>
            </div>

            {entries.length === 0 ? (
                <div className="empty-state">
                    <BookOpen size={48} style={{ opacity: 0.3 }} />
                    <p style={{ marginTop: 12 }}>Henuz hesap defteri kaydi yok.</p>
                </div>
            ) : (
                <>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {entries.map((entry) => {
                            const isCredit = entry.type === "CREDIT";
                            return (
                                <div key={entry.id || entry.entry_id} style={{
                                    background: "var(--bg-card)",
                                    borderRadius: 24,
                                    padding: 20,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 16,
                                    border: "1px solid var(--border-color)",
                                    boxShadow: "var(--shadow)",
                                }}>
                                    <div style={{
                                        width: 72,
                                        height: 72,
                                        borderRadius: 20,
                                        background: isCredit ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: isCredit ? "#10b981" : "#ef4444",
                                        fontWeight: 800,
                                        fontSize: 14,
                                    }}>
                                        {CATEGORY_EMOJIS[entry.category] || "[TX]"}
                                    </div>

                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>
                                            {CATEGORY_LABELS[entry.category] || entry.category || "Finansal islem"}
                                        </div>
                                        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                                            {new Date(entry.created_at).toLocaleString("tr-TR", {
                                                day: "2-digit",
                                                month: "2-digit",
                                                year: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </div>
                                        {entry.description && (
                                            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, fontStyle: "italic" }}>
                                                {entry.description}
                                            </div>
                                        )}
                                    </div>

                                    <div style={{
                                        fontSize: 22,
                                        fontWeight: 900,
                                        color: isCredit ? "var(--success)" : "#ef4444",
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "flex-end",
                                        gap: 8
                                    }}>
                                        <div>
                                            {isCredit ? "+" : "-"}
                                            {Number(entry.amount || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
                                        </div>
                                        {!isCredit && (
                                            <button
                                                onClick={() => {
                                                    setSplitModal({ show: true, entry });
                                                    setSplitTargets([{ alias: "", amount: "" }]);
                                                }}
                                                style={{
                                                    background: "rgba(37,99,235,0.1)", color: "#2563eb", border: "none",
                                                    padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                                                    display: "flex", alignItems: "center", gap: 6, cursor: "pointer", transition: "all 0.2s"
                                                }}
                                                onMouseOver={(e) => {
                                                    e.currentTarget.style.background = "#2563eb";
                                                    e.currentTarget.style.color = "#ffffff";
                                                }}
                                                onMouseOut={(e) => {
                                                    e.currentTarget.style.background = "rgba(37,99,235,0.1)";
                                                    e.currentTarget.style.color = "#2563eb";
                                                }}
                                            >
                                                <Users size={14} /> Bölüştür
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 0 60px 0" }}>
                        <button
                            className="btn btn-outline"
                            style={{ borderRadius: "var(--radius-full)", padding: "12px 24px", fontWeight: 700 }}
                            onClick={() => setSkip(Math.max(0, skip - limit))}
                            disabled={skip === 0}
                        >
                            <ChevronLeft size={20} /> Onceki
                        </button>
                        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-secondary)", background: "var(--bg-card)", padding: "8px 16px", borderRadius: 20 }}>
                            {skip + 1} - {Math.min(skip + limit, total)} / {total}
                        </span>
                        <button
                            className="btn btn-outline"
                            style={{ borderRadius: "var(--radius-full)", padding: "12px 24px", fontWeight: 700 }}
                            onClick={() => setSkip(skip + limit)}
                            disabled={skip + limit >= total}
                        >
                            Sonraki <ChevronRight size={20} />
                        </button>
                    </div>
                </>
            )}
            {/* Split Bill Modal */}
            {splitModal.show && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 999 }}>
                    <div style={{ background: "var(--bg-card)", borderRadius: 24, padding: 24, width: "100%", maxWidth: 480, boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
                                <Users size={22} color="#2563eb" /> Hesabı Bölüştür
                            </h2>
                            <button onClick={() => setSplitModal({ show: false, entry: null })} style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}><X size={24} /></button>
                        </div>

                        <div style={{ background: "var(--bg-secondary)", padding: 16, borderRadius: 12, marginBottom: 20 }}>
                            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Toplam Tutar</div>
                            <div style={{ fontSize: 24, fontWeight: 900, color: "var(--text-primary)" }}>
                                {Number(splitModal.entry.amount).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
                            </div>
                            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                                {splitModal.entry.description || CATEGORY_LABELS[splitModal.entry.category]}
                            </div>
                        </div>

                        <form onSubmit={handleSplitSubmit} style={{ display: "grid", gap: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <label style={{ fontSize: 14, fontWeight: 700 }}>Kişiler</label>
                                <button type="button" onClick={splitEqually} style={{ background: "transparent", border: "none", color: "#2563eb", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}>
                                    Eşit Böl (%{(100 / (splitTargets.length + 1)).toFixed(0)})
                                </button>
                            </div>

                            {splitTargets.map((target, index) => (
                                <div key={index} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                                    <div style={{ flex: 1 }}>
                                        <input
                                            className="form-input"
                                            placeholder="Telefon, E-Posta veya TC"
                                            value={target.alias}
                                            onChange={e => {
                                                const newTargets = [...splitTargets];
                                                newTargets[index].alias = e.target.value;
                                                setSplitTargets(newTargets);
                                            }}
                                            required
                                        />
                                    </div>
                                    <div style={{ width: 120 }}>
                                        <input
                                            className="form-input"
                                            type="number" min="0.01" step="0.01"
                                            placeholder="Tutar"
                                            value={target.amount}
                                            onChange={e => {
                                                const newTargets = [...splitTargets];
                                                newTargets[index].amount = e.target.value;
                                                setSplitTargets(newTargets);
                                            }}
                                            required
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeSplitTarget(index)}
                                        style={{ width: 44, height: 44, background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444", cursor: "pointer", transition: "all 0.2s" }}
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            ))}

                            <button type="button" onClick={addSplitTarget} style={{ background: "transparent", border: "1px dashed var(--border-color)", color: "var(--text-secondary)", padding: 12, borderRadius: 12, fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", transition: "all 0.2s" }}>
                                <Plus size={16} /> Kişi Ekle
                            </button>

                            <button type="submit" style={{ background: "#2563eb", color: "#fff", border: "none", padding: "14px", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10, transition: "opacity 0.2s" }} disabled={splitLoading}>
                                {splitLoading ? <RefreshCw size={18} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={18} />}
                                İstekleri Gönder
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
