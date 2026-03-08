import { useCallback, useEffect, useState } from "react";
import {
    ArrowDownLeft,
    ArrowUpRight,
    Download,
    Filter,
    History,
    Loader2,
    Search,
} from "lucide-react";
import { transactionApi } from "../services/api";

const CATEGORY_OPTIONS = [
    { value: "", label: "Tum kategoriler" },
    { value: "DEPOSIT", label: "Para yatirma" },
    { value: "WITHDRAWAL", label: "Para cekme" },
    { value: "TRANSFER_IN", label: "Gelen transfer" },
    { value: "TRANSFER_OUT", label: "Giden transfer" },
    { value: "BILL_PAYMENT", label: "Fatura odeme" },
    { value: "CARD_PAYMENT", label: "Kart odeme" },
    { value: "GOAL_CONTRIBUTION", label: "Hedef birikim" },
];

const TYPE_OPTIONS = [
    { value: "", label: "Tum yonler" },
    { value: "CREDIT", label: "Gelen" },
    { value: "DEBIT", label: "Giden" },
];

const CATEGORY_LABELS = {
    DEPOSIT: "Para yatirma",
    WITHDRAWAL: "Para cekme",
    TRANSFER_IN: "Gelen transfer",
    TRANSFER_OUT: "Giden transfer",
    BILL_PAYMENT: "Fatura odeme",
    CARD_PAYMENT: "Kart odemesi",
    GOAL_CONTRIBUTION: "Hedefe aktarim",
};

export default function TransferHistoryPage() {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [filter, setFilter] = useState({ type: "", category: "", search: "" });
    const limit = 20;

    const fetchHistory = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page, limit };
            if (filter.type) params.type = filter.type;
            if (filter.category) params.category = filter.category;
            if (filter.search.trim()) params.search = filter.search.trim();

            const res = await transactionApi.history(params);
            setEntries(Array.isArray(res.data?.data) ? res.data.data : []);
            setTotal(Number(res.data?.total || 0));
        } catch (error) {
            setEntries([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [filter.category, filter.search, filter.type, page]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const formatMoney = (value) => new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
    }).format(value || 0);

    const exportCsv = () => {
        if (!entries.length) return;
        const header = "Tarih,Tip,Kategori,Aciklama,Tutar\n";
        const rows = entries.map((entry) => {
            const date = new Date(entry.created_at).toLocaleString("tr-TR");
            const type = entry.type === "CREDIT" ? "Gelen" : "Giden";
            const category = CATEGORY_LABELS[entry.category] || entry.category || "Islem";
            const description = (entry.description || "").replaceAll(",", " ");
            return `${date},${type},${category},${description},${entry.amount}`;
        });
        const blob = new Blob([header + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `transfer-gecmisi-${new Date().toISOString().slice(0, 10)}.csv`;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    const totalIn = entries
        .filter((entry) => entry.type === "CREDIT")
        .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const totalOut = entries
        .filter((entry) => entry.type === "DEBIT")
        .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const hasNextPage = page * limit < total;

    return (
        <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
                        <History size={28} color="#2563eb" /> Transfer gecmisi
                    </h1>
                    <p style={{ color: "var(--text-secondary)", margin: "8px 0 0" }}>
                        Para hareketlerinizi, transferlerinizi ve odemelerinizi tek ekranda izleyin.
                    </p>
                </div>
                <button onClick={exportCsv} style={secondaryButtonStyle}>
                    <Download size={16} /> CSV indir
                </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
                <SummaryCard label="Toplam gelen" value={`+${formatMoney(totalIn)}`} accent="#10b981" />
                <SummaryCard label="Toplam giden" value={`-${formatMoney(totalOut)}`} accent="#ef4444" />
                <SummaryCard label="Net hareket" value={formatMoney(totalIn - totalOut)} accent="#2563eb" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 16 }}>
                <div style={{ position: "relative" }}>
                    <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: "var(--text-secondary)" }} />
                    <input
                        value={filter.search}
                        onChange={(event) => {
                            setPage(1);
                            setFilter((prev) => ({ ...prev, search: event.target.value }));
                        }}
                        placeholder="Aciklama veya kategori ara"
                        style={{ ...inputStyle, paddingLeft: 38 }}
                    />
                </div>

                <select
                    value={filter.type}
                    onChange={(event) => {
                        setPage(1);
                        setFilter((prev) => ({ ...prev, type: event.target.value }));
                    }}
                    style={inputStyle}
                >
                    {TYPE_OPTIONS.map((option) => (
                        <option key={option.value || "all"} value={option.value}>{option.label}</option>
                    ))}
                </select>

                <div style={{ position: "relative" }}>
                    <Filter size={16} style={{ position: "absolute", left: 12, top: 12, color: "var(--text-secondary)" }} />
                    <select
                        value={filter.category}
                        onChange={(event) => {
                            setPage(1);
                            setFilter((prev) => ({ ...prev, category: event.target.value }));
                        }}
                        style={{ ...inputStyle, paddingLeft: 38 }}
                    >
                        {CATEGORY_OPTIONS.map((option) => (
                            <option key={option.value || "all"} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: "center", padding: 56 }}>
                    <Loader2 size={28} style={{ animation: "spin 1s linear infinite" }} />
                </div>
            ) : entries.length === 0 ? (
                <div style={emptyStateStyle}>
                    Bu filtrelere uygun islem bulunamadi.
                </div>
            ) : (
                <div style={listStyle}>
                    {entries.map((entry, index) => {
                        const isCredit = entry.type === "CREDIT";
                        return (
                            <div key={entry.id || entry.entry_id || index} style={{ ...rowStyle, borderBottom: index < entries.length - 1 ? "1px solid var(--border-color)" : "none" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                                    <div style={{
                                        width: 42,
                                        height: 42,
                                        borderRadius: 14,
                                        background: isCredit ? "rgba(16,185,129,0.14)" : "rgba(239,68,68,0.14)",
                                        color: isCredit ? "#10b981" : "#ef4444",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}>
                                        {isCredit ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 14 }}>
                                            {entry.description || CATEGORY_LABELS[entry.category] || "Finansal islem"}
                                        </div>
                                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap" }}>
                                            <span>{CATEGORY_LABELS[entry.category] || entry.category || "Diger"}</span>
                                            <span>•</span>
                                            <span>{new Date(entry.created_at).toLocaleString("tr-TR")}</span>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: isCredit ? "#10b981" : "#ef4444" }}>
                                    {isCredit ? "+" : "-"}{formatMoney(entry.amount)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 18 }}>
                <button disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))} style={paginationButtonStyle}>
                    Onceki
                </button>
                <span style={{ padding: "10px 14px", fontWeight: 600, color: "var(--text-secondary)" }}>
                    Sayfa {page}
                </span>
                <button disabled={!hasNextPage} onClick={() => setPage((prev) => prev + 1)} style={paginationButtonStyle}>
                    Sonraki
                </button>
            </div>

            <style>{"@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }"}</style>
        </div>
    );
}

function SummaryCard({ label, value, accent }) {
    return (
        <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: "16px 18px", border: "1px solid var(--border-color)", borderLeft: `4px solid ${accent}` }}>
            <div style={{ color: "var(--text-secondary)", fontSize: 12, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: accent }}>{value}</div>
        </div>
    );
}

const inputStyle = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid var(--border-color)",
    background: "var(--bg-secondary)",
    color: "var(--text-primary)",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
};

const secondaryButtonStyle = {
    padding: "10px 16px",
    borderRadius: 12,
    border: "1px solid var(--border-color)",
    background: "var(--bg-card)",
    color: "var(--text-primary)",
    fontWeight: 600,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
};

const emptyStateStyle = {
    background: "var(--bg-card)",
    borderRadius: 18,
    border: "1px solid var(--border-color)",
    color: "var(--text-secondary)",
    textAlign: "center",
    padding: 48,
};

const listStyle = {
    background: "var(--bg-card)",
    borderRadius: 18,
    border: "1px solid var(--border-color)",
    overflow: "hidden",
};

const rowStyle = {
    padding: "16px 18px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
};

const paginationButtonStyle = {
    padding: "10px 16px",
    borderRadius: 10,
    border: "1px solid var(--border-color)",
    background: "var(--bg-card)",
    color: "var(--text-primary)",
    fontWeight: 600,
    cursor: "pointer",
};
