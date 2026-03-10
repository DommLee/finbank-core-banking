import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { accountApi, customerApi, ledgerApi } from "../services/api";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

export default function DashboardPage() {
    const { user, isAdmin } = useAuth();
    const navigate = useNavigate();
    const [accounts, setAccounts] = useState([]);
    const [balances, setBalances] = useState({});
    const [customer, setCustomer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showBalance, setShowBalance] = useState(true);
    const [recentTx, setRecentTx] = useState([]);
    const [customerForm, setCustomerForm] = useState({
        full_name: "",
        national_id: "",
        phone: "",
        date_of_birth: "",
        address: "",
    });
    const [showCustomerForm, setShowCustomerForm] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const accRes = await accountApi.listMine();
            setAccounts(accRes.data);
            const balanceMap = {};
            for (const acc of accRes.data) {
                try {
                    const balRes = await accountApi.getBalance(acc.id);
                    balanceMap[acc.id] = balRes.data.balance;
                } catch {
                    balanceMap[acc.id] = 0;
                }
            }
            setBalances(balanceMap);
            try {
                const custRes = await customerApi.getMe();
                setCustomer(custRes.data);
            } catch {
                setShowCustomerForm(true);
            }
            try {
                const txRes = await ledgerApi.getEntries({ skip: 0, limit: 5 });
                setRecentTx(txRes.data.entries || []);
            } catch {
                // ignore
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const createCustomer = async (e) => {
        e.preventDefault();
        try {
            const res = await customerApi.create(customerForm);
            setCustomer(res.data);
            setShowCustomerForm(false);
            toast.success("Müşteri profili oluşturuldu!");
        } catch (err) {
            toast.error(err.response?.data?.detail || "Profil oluşturulamadı");
        }
    };

    const totalBalance = Object.values(balances).reduce((a, b) => a + b, 0);
    const mainAccount = accounts[0];

    // Format helpers
    const formatMoney = (val) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2 }).format(val);
    const wholeNumber = Math.floor(totalBalance).toLocaleString("tr-TR");
    const decimalPart = (totalBalance % 1).toFixed(2).substring(2);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="relative flex min-h-[calc(100vh-80px)] w-full flex-col overflow-x-hidden mesh-gradient pb-24 font-display">
            {/* Header */}
            <header className="flex items-center px-6 pt-8 pb-4 justify-between">
                <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full border border-primary/20 p-0.5">
                        <img
                            alt="User Profile"
                            className="rounded-full w-full h-full object-cover"
                            src="https://images.unsplash.com/photo-1568602471122-7832951cc4c5?q=80&w=200&auto=format&fit=crop"
                        />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Premium Tier</p>
                        <h2 className="text-slate-900 dark:text-slate-100 text-sm font-semibold leading-tight">
                            {customer?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "Misafir"}
                        </h2>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button className="flex size-10 items-center justify-center rounded-full glass-card text-slate-800 dark:text-slate-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                        <span className="material-symbols-outlined text-[20px]">search</span>
                    </button>
                    <button className="relative flex size-10 items-center justify-center rounded-full glass-card text-slate-800 dark:text-slate-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                        <span className="material-symbols-outlined text-[20px]">notifications</span>
                        {customer?.status !== "active" && (
                            <span className="absolute top-2 right-2 size-2 bg-rose-500 rounded-full border-2 border-white dark:border-[#0a0a16]"></span>
                        )}
                    </button>
                </div>
            </header>

            {/* Customer Registration Form */}
            {showCustomerForm && !customer && (
                <section className="px-6 mb-6">
                    <div className="glass-card !bg-amber-500/10 !border-amber-500/30 rounded-xl p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <AlertCircle size={24} className="text-amber-500" />
                            <h3 className="text-amber-600 dark:text-amber-400 font-semibold text-lg">Profili Tamamlayın</h3>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 mb-6 text-sm">
                            Bankacılık işlemlerine başlamak için lütfen profil bilgilerinizi doldurun.
                        </p>
                        <form onSubmit={createCustomer} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Ad Soyad</label>
                                    <input className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" placeholder="Ali Veli" value={customerForm.full_name} onChange={e => setCustomerForm({ ...customerForm, full_name: e.target.value })} required />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">TC Kimlik</label>
                                    <input className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" placeholder="11 haneli" value={customerForm.national_id} onChange={e => setCustomerForm({ ...customerForm, national_id: e.target.value })} required pattern="\\d{11}" maxLength="11" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Telefon</label>
                                    <input className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" placeholder="+905551234567" value={customerForm.phone} onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })} required />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Doğum Tarihi</label>
                                    <input type="date" className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" value={customerForm.date_of_birth} onChange={e => setCustomerForm({ ...customerForm, date_of_birth: e.target.value })} required />
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-primary text-white py-3 rounded-xl font-semibold shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all mt-2">
                                Profili Oluştur
                            </button>
                        </form>
                    </div>
                </section>
            )}

            {/* Balance Section */}
            {customer && (
                <section className="px-6 py-6 text-center cursor-pointer" onClick={() => setShowBalance(!showBalance)}>
                    <p className="text-slate-500 text-sm font-medium mb-1 font-outfit">Toplam Bakiyen</p>
                    <h1 className="text-slate-900 dark:text-slate-100 tracking-tight text-5xl font-bold leading-tight neon-glow font-outfit">
                        {showBalance ? (
                            <>
                                ₺{wholeNumber}<span className="text-2xl opacity-60">.{decimalPart}</span>
                            </>
                        ) : (
                            <span className="tracking-widest opacity-80">••••••••</span>
                        )}
                    </h1>
                    <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <span className="material-symbols-outlined text-emerald-500 text-xs">trending_up</span>
                        <p className="text-emerald-500 text-[10px] font-bold uppercase tracking-wider">+%2.5 bu ay</p>
                    </div>
                </section>
            )}

            {/* 3D Floating Card */}
            {customer && accounts.length > 0 && (
                <section className="px-6 py-4">
                    <div className="relative group">
                        {/* Shadow/Glow behind card */}
                        <div className="absolute inset-0 bg-primary/30 blur-[40px] rounded-xl translate-y-4"></div>

                        {/* Main Card Body */}
                        <div className="relative glass-card !bg-black/80 dark:!bg-white/5 rounded-2xl p-6 aspect-[1.586/1] overflow-hidden flex flex-col justify-between border-white/20 shadow-2xl transition-transform duration-500 hover:scale-[1.02]">
                            {/* Card Background Elements */}
                            <div className="absolute -top-10 -right-10 size-40 bg-primary/40 rounded-full blur-3xl"></div>
                            <div className="absolute top-0 right-0 p-6 opacity-30 text-white">
                                <svg fill="none" height="40" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" width="40">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <circle cx="12" cy="12" r="4"></circle>
                                </svg>
                            </div>

                            <div className="flex justify-between items-start z-10">
                                <div className="flex flex-col">
                                    <p className="text-[10px] text-slate-300 font-bold uppercase tracking-[0.2em] mb-1">Hesap / İban</p>
                                    <p className="text-white text-lg font-outfit font-semibold">{mainAccount?.account_type === "checking" ? "Vadesiz" : "Tasarruf"}</p>
                                </div>
                                <span className="material-symbols-outlined text-slate-100 text-3xl">contactless</span>
                            </div>

                            <div className="space-y-4 z-10">
                                <div className="flex gap-4 items-center">
                                    <span className="text-slate-100 text-sm md:text-md opacity-80 tracking-widest font-mono">
                                        {mainAccount?.iban ? `${mainAccount.iban.substring(0, 4)} ${mainAccount.iban.substring(4, 8)} **** **** ${mainAccount.iban.substring(mainAccount.iban.length - 4)}` : "**** **** **** 8829"}
                                    </span>
                                </div>
                                <div className="flex justify-between items-end">
                                    <div className="flex flex-col">
                                        <p className="text-[10px] text-slate-300 font-bold uppercase tracking-[0.2em]">Ad Soyad</p>
                                        <p className="text-slate-100 text-sm font-outfit tracking-wider">{customer?.full_name?.toUpperCase()}</p>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <p className="text-[10px] text-slate-300 font-bold uppercase tracking-[0.2em]">Aktif</p>
                                        <p className="text-slate-100 text-sm font-outfit">09/28</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* Quick Actions */}
            <section className="grid grid-cols-3 gap-4 px-6 py-6">
                <Link to="/customer/transfer" className="flex flex-col items-center gap-2 group cursor-pointer no-underline">
                    <div className="size-16 rounded-2xl glass-card flex items-center justify-center bg-gradient-to-br from-primary/30 to-primary/5 border-primary/20 group-hover:scale-105 transition-transform duration-300 shadow-lg shadow-primary/10">
                        <span className="material-symbols-outlined text-primary text-3xl">send</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 font-outfit">Gönder</p>
                </Link>
                <Link to="/customer/transfer" className="flex flex-col items-center gap-2 group cursor-pointer no-underline">
                    <div className="size-16 rounded-2xl glass-card flex items-center justify-center bg-gradient-to-br from-emerald-500/30 to-emerald-500/5 border-emerald-500/20 group-hover:scale-105 transition-transform duration-300 shadow-lg shadow-emerald-500/10">
                        <span className="material-symbols-outlined text-emerald-500 text-3xl">download</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 font-outfit">Al / İste</p>
                </Link>
                <Link to="/customer/accounts" className="flex flex-col items-center gap-2 group cursor-pointer no-underline">
                    <div className="size-16 rounded-2xl glass-card flex items-center justify-center bg-gradient-to-br from-amber-500/30 to-amber-500/5 border-amber-500/20 group-hover:scale-105 transition-transform duration-300 shadow-lg shadow-amber-500/10">
                        <span className="material-symbols-outlined text-amber-500 text-3xl">add_card</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 font-outfit">Yeni Hesap</p>
                </Link>
            </section>

            {/* Transactions List */}
            <section className="px-6 py-4 flex-1">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-slate-900 dark:text-slate-100 font-outfit font-semibold text-lg">Son İşlemler</h3>
                    <Link to="/customer/ledger" className="text-primary text-xs font-bold uppercase tracking-wider hover:underline">Tümünü Gör</Link>
                </div>

                {recentTx.length === 0 ? (
                    <div className="p-8 text-center glass-card rounded-2xl">
                        <span className="material-symbols-outlined text-5xl text-slate-400 mb-2">receipt_long</span>
                        <p className="text-slate-500 text-sm">Henüz bir işleminiz bulunmuyor.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {recentTx.map((tx, idx) => {
                            const isCredit = tx.type === "CREDIT";
                            const icon = isCredit ? "arrow_downward" : "arrow_upward";
                            const iconColorClass = isCredit ? "text-emerald-500" : "text-rose-500";
                            const bgClass = isCredit ? "bg-emerald-500/10" : "bg-rose-500/10";
                            const defaultTitle = isCredit ? "Gelen Para" : "Giden Para";

                            return (
                                <div key={tx.id || idx} className="glass-card rounded-xl p-4 flex items-center justify-between border-black/5 dark:border-white/5 hover:border-black/10 dark:hover:border-white/10 transition-all cursor-pointer">
                                    <div className="flex items-center gap-4">
                                        <div className={`size-10 rounded-lg ${bgClass} flex items-center justify-center`}>
                                            <span className={`material-symbols-outlined ${iconColorClass}`}>{icon}</span>
                                        </div>
                                        <div>
                                            <p className="text-slate-900 dark:text-slate-100 font-outfit font-medium text-sm">
                                                {tx.description || defaultTitle}
                                            </p>
                                            <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                                                {tx.category || "Transfer"} • {new Date(tx.created_at).toLocaleDateString("tr-TR", { month: "short", day: "numeric" })}
                                            </p>
                                        </div>
                                    </div>
                                    <p className={`${isCredit ? 'text-emerald-500' : 'text-slate-900 dark:text-slate-100'} font-outfit font-bold`}>
                                        {isCredit ? '+' : '-'}₺{Math.abs(tx.amount).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}

