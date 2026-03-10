import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
    ArrowLeft, Send, CheckCircle2, Copy, Wallet,
    ArrowDownToLine, ArrowUpFromLine, Users
} from "lucide-react";
import { accountApi, transactionApi } from "../services/api";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function TransferPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const rolePath = `/${user?.role || 'customer'}`;

    const [activeTab, setActiveTab] = useState("transfer");
    const [accounts, setAccounts] = useState([]);
    const [easyAddresses, setEasyAddresses] = useState([]);
    const [balances, setBalances] = useState({});

    // Forms
    const [accountId, setAccountId] = useState("");
    const [target, setTarget] = useState("");
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");

    const [loading, setLoading] = useState(false);
    const [bootLoading, setBootLoading] = useState(true);
    const [receipt, setReceipt] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setBootLoading(true);
        try {
            const [accountsRes, aliasesRes] = await Promise.all([
                accountApi.listMine(),
                accountApi.listEasyAddresses(),
            ]);
            const nextAccounts = Array.isArray(accountsRes.data) ? accountsRes.data : [];
            const nextAliases = Array.isArray(aliasesRes.data) ? aliasesRes.data : [];
            setAccounts(nextAccounts);
            setEasyAddresses(nextAliases);

            const nextBalances = {};
            for (const account of nextAccounts) {
                const id = account.id || account.account_id;
                nextBalances[id] = account.account_type === 'credit'
                    ? Number(account.balance || 0) + Number(account.overdraft_limit || 0)
                    : Number(account.balance || 0);
            }
            setBalances(nextBalances);

            if (nextAccounts.length > 0 && !accountId) {
                setAccountId(nextAccounts[0].id || nextAccounts[0].account_id);
            }
        } catch (error) {
            toast.error("Veriler yüklenemedi.");
        } finally {
            setBootLoading(false);
        }
    };

    const showReceipt = (type, amt, desc, targetLabel = "") => {
        setReceipt({
            type,
            amount: Number(amt),
            description: desc,
            targetLabel,
            date: new Date().toLocaleString("tr-TR"),
            ref: `FIN-${Date.now().toString(36).toUpperCase()}`,
        });
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        if (!amount || Number(amount) <= 0) return toast.error("Geçerli bir tutar girin.");

        setLoading(true);
        try {
            if (activeTab === "transfer") {
                if (!target) return toast.error("Lütfen bir alıcı belirtin.");
                const payload = { from_account_id: accountId, amount: Number(amount), description };
                const t = target.trim();
                if (t.toUpperCase().startsWith("TR")) payload.target_iban = t;
                else if (/^[a-f\\d]{24}$/i.test(t)) payload.to_account_id = t;
                else payload.target_alias = t;

                await transactionApi.transfer(payload);
                showReceipt("Transfer", amount, description, t);
            }
            else if (activeTab === "deposit") {
                await transactionApi.deposit({ account_id: accountId, amount: Number(amount), description });
                toast.success("Para yatırma talebiniz alındı. Onay sonrası hesaba geçecektir.");
                loadData();
            }
            else if (activeTab === "withdraw") {
                await transactionApi.withdraw({ account_id: accountId, amount: Number(amount), description });
                showReceipt("Para Çekme", amount, description);
            }

            // Reset fields
            setTarget("");
            setAmount("");
            setDescription("");
        } catch (error) {
            toast.error(error.response?.data?.detail || "İşlem başarısız.");
        } finally {
            setLoading(false);
        }
    };

    const getPrimaryColor = () => {
        if (activeTab === "transfer") return "primary";
        if (activeTab === "deposit") return "emerald-500";
        return "rose-500";
    };
    const primaryColor = getPrimaryColor();

    if (bootLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    if (receipt) {
        return (
            <div className="min-h-[calc(100vh-80px)] mesh-gradient p-6 flex flex-col items-center justify-center font-display pb-20">
                <div className="glass-card w-full max-w-sm rounded-[2rem] p-8 text-center animate-[popIn_0.5s_ease-out]">
                    <div className="size-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 ring-4 ring-emerald-500/30">
                        <CheckCircle2 size={40} className="text-emerald-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2 font-outfit">İşlem Başarılı</h2>
                    <p className="text-slate-500 text-sm mb-6">{receipt.type} başarıyla gerçekleştirildi.</p>

                    <div className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-8 neon-glow">
                        ₺{receipt.amount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                    </div>

                    <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-4 text-left space-y-3 mb-8">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Tarih</span>
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{receipt.date}</span>
                        </div>
                        {receipt.targetLabel && (
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Alıcı</span>
                                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{receipt.targetLabel}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Referans</span>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-slate-900 dark:text-slate-100">{receipt.ref}</span>
                                <button onClick={() => toast.success("Kopyalandı")}><Copy size={12} className="text-primary" /></button>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={() => setReceipt(null)} className="flex-1 bg-black/5 dark:bg-white/10 text-slate-900 dark:text-slate-100 py-3 rounded-xl font-semibold hover:bg-black/10 dark:hover:bg-white/20 transition-colors">
                            Yeni İşlem
                        </button>
                        <Link to={`${rolePath}/dashboard`} className="flex-1 bg-primary text-white py-3 rounded-xl font-semibold shadow-lg shadow-primary/30 hover:bg-primary/90 transition-colors text-center no-underline">
                            Ana Sayfa
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative min-h-[calc(100vh-80px)] w-full flex-col overflow-x-hidden mesh-gradient pb-24 font-display">
            {/* Header */}
            <header className="flex items-center px-6 pt-8 pb-4">
                <button onClick={() => navigate(-1)} className="size-10 flex items-center justify-center rounded-full glass-card hover:bg-white/10 transition-colors mr-4">
                    <ArrowLeft size={20} className="text-slate-900 dark:text-slate-100" />
                </button>
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 font-outfit">İşlemler</h1>
            </header>

            {/* Tabs */}
            <div className="px-6 mb-8">
                <div className="flex p-1 bg-black/5 dark:bg-white/5 rounded-2xl backdrop-blur-md border border-black/10 dark:border-white/10">
                    <button
                        onClick={() => setActiveTab("transfer")}
                        className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'transfer' ? 'bg-primary text-white shadow-lg' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'}`}
                    >
                        <Send size={16} /> Transfer
                    </button>
                    <button
                        onClick={() => setActiveTab("deposit")}
                        className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'deposit' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'}`}
                    >
                        <ArrowDownToLine size={16} /> Yatır
                    </button>
                    <button
                        onClick={() => setActiveTab("withdraw")}
                        className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'withdraw' ? 'bg-rose-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'}`}
                    >
                        <ArrowUpFromLine size={16} /> Çek
                    </button>
                </div>
            </div>

            <form onSubmit={onSubmit} className="px-6 space-y-6">

                {/* Account Selector */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Kaynak Hesap</label>
                    <select
                        value={accountId}
                        onChange={(e) => setAccountId(e.target.value)}
                        className="w-full glass-card bg-white/50 dark:bg-black/50 border border-black/10 dark:border-white/10 rounded-2xl px-4 py-4 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
                        required
                    >
                        {accounts.map(acc => {
                            const id = acc.id || acc.account_id;
                            const bal = balances[id] || 0;
                            return (
                                <option key={id} value={id} className="text-slate-900">
                                    {acc.account_name || "Hesap"} • ₺{bal.toLocaleString("tr-TR")}
                                </option>
                            );
                        })}
                    </select>
                </div>

                {/* Target Selector (Only for Transfer) */}
                {activeTab === "transfer" && (
                    <div className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Alıcı (IBAN, Tel, E-posta)</label>
                            <input
                                value={target}
                                onChange={(e) => setTarget(e.target.value)}
                                placeholder="TR00 0000..."
                                className="w-full glass-card bg-transparent border border-black/10 dark:border-white/10 rounded-2xl px-4 py-4 text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder/30"
                                required
                            />
                        </div>

                        {/* Quick Contacts (Easy Addresses) */}
                        {easyAddresses.length > 0 && (
                            <div className="pt-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 mb-3 block">Hızlı Gönderim</label>
                                <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x">
                                    {easyAddresses.map(addr => (
                                        <div
                                            key={addr.id}
                                            onClick={() => setTarget(addr.alias_value)}
                                            className="snap-start flex flex-col items-center gap-2 cursor-pointer group min-w-[70px]"
                                        >
                                            <div className={`size-14 rounded-2xl glass-card flex items-center justify-center border-black/5 dark:border-white/5 group-hover:bg-primary/20 group-hover:border-primary/50 transition-all ${target === addr.alias_value ? 'ring-2 ring-primary ring-offset-2 ring-offset-[#0a0a16]' : ''}`}>
                                                <Users size={24} className="text-slate-700 dark:text-slate-300 group-hover:text-primary" />
                                            </div>
                                            <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 text-center truncate w-full px-1">
                                                {addr.label || "Kişi"}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Amount Input */}
                <div className="space-y-2 pt-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Tutar</label>
                    <div className="relative">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-3xl font-bold text-slate-400">₺</span>
                        <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full glass-card bg-black/5 rounded-3xl pl-16 pr-6 py-6 text-4xl font-bold font-outfit text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary tracking-tighter"
                            required
                        />
                    </div>
                </div>

                {/* Description Input */}
                <div className="space-y-2 pt-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Açıklama</label>
                    <input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Kira, fatura, borç vb."
                        className="w-full glass-card bg-transparent border border-black/10 dark:border-white/10 rounded-2xl px-4 py-4 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                </div>

                {/* Submit Push Button */}
                <div className="pt-6">
                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full group relative overflow-hidden rounded-[2rem] p-4 font-bold text-lg text-white shadow-2xl transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed ${activeTab === 'transfer' ? 'bg-primary shadow-primary/30' :
                                activeTab === 'deposit' ? 'bg-emerald-500 shadow-emerald-500/30' :
                                    'bg-rose-500 shadow-rose-500/30'
                            }`}
                    >
                        <span className="relative z-10 font-outfit tracking-wide flex items-center justify-center gap-2">
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    İşleniyor...
                                </span>
                            ) : (
                                <>
                                    {activeTab === 'transfer' ? 'Gönder' : activeTab === 'deposit' ? 'Para Yatır' : 'Para Çek'}
                                    <ArrowLeft className="rotate-135 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" size={20} />
                                </>
                            )}
                        </span>

                        {/* Interactive glow effect */}
                        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                    </button>
                </div>
            </form>
        </div>
    );
}

