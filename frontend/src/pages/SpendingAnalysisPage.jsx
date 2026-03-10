import { useState, useEffect } from "react";
import { BarChart3, PieChart, TrendingDown, TrendingUp, ArrowLeft, Loader2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { analyticsApi } from "../services/api";
import { useNavigate } from "react-router-dom";

const CATEGORY_LABELS = {
    WITHDRAWAL: "Para Çekme",
    TRANSFER_OUT: "Transfer (Giden)",
    DEPOSIT: "Para Yatırma",
    TRANSFER_IN: "Transfer (Gelen)",
};

export default function SpendingAnalysisPage() {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            try {
                const res = await analyticsApi.spendingAnalysis();
                setData(res.data);
            } catch { /* fail silently */ }
            setLoading(false);
        };
        fetch();
    }, []);

    const fmt = (n) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n || 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    const totalSpent = data?.by_category?.reduce((s, c) => s + c.total, 0) || 0;
    const totalCount = data?.by_category?.reduce((s, c) => s + c.count, 0) || 0;
    const catCount = data?.by_category?.length || 0;

    return (
        <div className="relative min-h-[calc(100vh-80px)] w-full flex-col overflow-x-hidden mesh-gradient pb-24 font-display">
            {/* Header */}
            <header className="flex items-center px-6 pt-8 pb-6">
                <button onClick={() => navigate(-1)} className="size-10 flex items-center justify-center rounded-full glass-card hover:bg-white/10 transition-colors mr-4">
                    <ArrowLeft size={20} className="text-slate-900 dark:text-slate-100" />
                </button>
                <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-primary/20 flex items-center justify-center">
                        <BarChart3 size={20} className="text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-outfit">Analizler</h1>
                </div>
            </header>

            <div className="px-6 space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="glass-card p-4 rounded-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <TrendingDown size={40} className="text-rose-500" />
                        </div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Giden (30 G)</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-slate-100 font-outfit neon-glow">{fmt(totalSpent)}</p>
                    </div>

                    <div className="glass-card p-4 rounded-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <PieChart size={40} className="text-emerald-500" />
                        </div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">İşlem Sayısı</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-slate-100 font-outfit">{totalCount} <span className="text-sm font-medium text-slate-500">adet</span></p>
                    </div>
                </div>

                {/* Category Breakdown (3D Bar Style) */}
                <div className="glass-card p-5 rounded-3xl relative overflow-hidden">
                    {/* Decorative element */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>

                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6 font-outfit flex items-center gap-2">
                        <PieChart size={18} className="text-primary" /> Kategoriler
                    </h2>

                    {(!data?.by_category || data.by_category.length === 0) ? (
                        <div className="py-8 text-center">
                            <p className="text-slate-500 text-sm">Henüz işlem verisi bulunmuyor.</p>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {data.by_category.map((c, i) => {
                                const pct = totalSpent > 0 ? Math.round((c.total / totalSpent) * 100) : 0;
                                // Assign distinct colors based on index or category
                                const isIncome = c.category === 'DEPOSIT' || c.category === 'TRANSFER_IN';
                                const colorClass = isIncome ? 'bg-emerald-500' :
                                    (i % 3 === 0 ? 'bg-primary' : i % 3 === 1 ? 'bg-rose-500' : 'bg-amber-500');
                                const shadowClass = isIncome ? 'shadow-emerald-500/50' :
                                    (i % 3 === 0 ? 'shadow-primary/50' : i % 3 === 1 ? 'shadow-rose-500/50' : 'shadow-amber-500/50');

                                return (
                                    <div key={c.category} className="group cursor-default">
                                        <div className="flex justify-between items-end mb-2">
                                            <div>
                                                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{CATEGORY_LABELS[c.category] || c.category}</h3>
                                                <p className="text-[10px] text-slate-500">{c.count} işlem</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{fmt(c.total)}</p>
                                                <p className="text-[10px] text-slate-500 font-mono">{pct}%</p>
                                            </div>
                                        </div>

                                        {/* 3D Progress Bar */}
                                        <div className="h-3 w-full bg-black/10 dark:bg-white/5 rounded-full overflow-hidden p-[2px]">
                                            <div
                                                className={`h-full rounded-full ${colorClass} ${shadowClass} shadow-[0_0_10px_rgba(0,0,0,0.5)] transition-all duration-1000 ease-out relative overflow-hidden`}
                                                style={{ width: `${Math.max(pct, 2)}%` }} // Give at least 2% so the bubble shows
                                            >
                                                {/* Glossy highlight for 3D effect */}
                                                <div className="absolute top-0 left-0 right-0 h-1/3 bg-white/30 rounded-t-full"></div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Daily Trends Timeline */}
                <div className="glass-card p-5 rounded-3xl relative overflow-hidden mb-8">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6 font-outfit flex items-center gap-2">
                        <TrendingUp size={18} className="text-primary" /> Günlük Döküm
                    </h2>

                    {(!data?.daily || data.daily.length === 0) ? (
                        <div className="py-8 text-center">
                            <p className="text-slate-500 text-sm">Günlük hareket bulunmuyor.</p>
                        </div>
                    ) : (
                        <div className="relative border-l border-black/10 dark:border-white/10 ml-3 space-y-6 pb-2">
                            {data.daily.map((d, i) => {
                                const isIncome = d.type === "CREDIT";
                                return (
                                    <div key={i} className="relative pl-6">
                                        {/* Timeline dot */}
                                        <div className={`absolute -left-[5px] top-1 h-[9px] w-[9px] rounded-full ring-4 ring-[#0a0a16] ${isIncome ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>

                                        <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-3 flex justify-between items-center border border-black/5 dark:border-white/5 backdrop-blur-sm hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                                            <div>
                                                <p className="text-xs font-bold text-slate-500 mb-0.5">{d.date}</p>
                                                <div className="flex items-center gap-1.5">
                                                    {isIncome ? <ArrowDownRight size={14} className="text-emerald-500" /> : <ArrowUpRight size={14} className="text-rose-500" />}
                                                    <span className={`text-xs font-semibold ${isIncome ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                        {isIncome ? "Giriş" : "Çıkış"}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className={`font-bold font-outfit ${isIncome ? 'text-emerald-500' : 'text-slate-900 dark:text-slate-100'}`}>
                                                {isIncome ? '+' : '-'}{fmt(d.total)}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

