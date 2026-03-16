import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import {
    AlertCircle,
    ArrowDownRight,
    ArrowUpRight,
    Eye,
    EyeOff,
    HandCoins,
    Landmark,
    Plus,
    QrCode,
    ReceiptText,
    Send,
    ShieldCheck,
    Sparkles,
    Wallet,
} from "lucide-react";
import { accountApi, customerApi, ledgerApi } from "../services/api";
import {
    BankActionTile,
    BankEmptyState,
    BankGlassCard,
    BankListRow,
    BankMetricCard,
    BankPageHeader,
    BankSectionCard,
} from "../components/banking/BankUi";
import TransactionReceipt from "../components/TransactionReceipt";

const onboardingFields = [
    { key: "full_name", label: "Ad Soyad", type: "text", placeholder: "Örnek: Abdullah Çelebi" },
    { key: "national_id", label: "TC Kimlik", type: "text", placeholder: "11 haneli kimlik numarası" },
    { key: "phone", label: "Telefon", type: "tel", placeholder: "+90 5xx xxx xx xx" },
    { key: "date_of_birth", label: "Doğum Tarihi", type: "date" },
    { key: "address", label: "Adres", type: "text", placeholder: "Mahalle, ilçe, şehir" },
];

export default function DashboardPage() {
    const [accounts, setAccounts] = useState([]);
    const [balances, setBalances] = useState({});
    const [customer, setCustomer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showBalance, setShowBalance] = useState(true);
    const [recentTx, setRecentTx] = useState([]);
    const [selectedTx, setSelectedTx] = useState(null);
    const [customerForm, setCustomerForm] = useState({
        full_name: "",
        national_id: "",
        phone: "",
        date_of_birth: "",
        address: "",
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const accountsRes = await accountApi.listMine();
            const nextAccounts = Array.isArray(accountsRes.data) ? accountsRes.data : [];
            setAccounts(nextAccounts);

            const balanceEntries = await Promise.all(
                nextAccounts.map(async (account) => {
                    const accountId = account.id || account.account_id;
                    try {
                        const balanceRes = await accountApi.getBalance(accountId);
                        return [accountId, Number(balanceRes.data?.balance || 0)];
                    } catch {
                        return [accountId, Number(account.balance || 0)];
                    }
                }),
            );
            setBalances(Object.fromEntries(balanceEntries));

            try {
                const customerRes = await customerApi.getMe();
                setCustomer(customerRes.data);
            } catch {
                setCustomer(null);
            }

            try {
                const txRes = await ledgerApi.getEntries({ skip: 0, limit: 6 });
                setRecentTx(Array.isArray(txRes.data?.entries) ? txRes.data.entries : Array.isArray(txRes.data) ? txRes.data : []);
            } catch {
                setRecentTx([]);
            }
        } catch (error) {
            toast.error("Dashboard verileri yüklenemedi.");
        } finally {
            setLoading(false);
        }
    };

    const createCustomer = async (event) => {
        event.preventDefault();
        try {
            const res = await customerApi.create(customerForm);
            setCustomer(res.data);
            toast.success("Müşteri profiliniz oluşturuldu.");
            loadData();
        } catch (error) {
            toast.error(error.response?.data?.detail || "Profil oluşturulamadı.");
        }
    };

    const totalBalance = useMemo(
        () => Object.values(balances).reduce((sum, value) => sum + Number(value || 0), 0),
        [balances],
    );

    const spendingBars = [42, 68, 54, 82, 63, 74, 88];

    const formatCurrency = (value, currency = "TRY") => new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
    }).format(Number(value || 0));

    const maskedBalance = showBalance ? formatCurrency(totalBalance) : "••••••••";

    if (loading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-8">
            <BankPageHeader
                eyebrow="Premium Dashboard"
                title={`Hoş geldin${customer?.full_name ? `, ${customer.full_name.split(" ")[0]}` : ""}`}
                description="Güncel bakiye, işlem akışı ve hızlı bankacılık aksiyonlarını tek bakışta yönet.">
            </BankPageHeader>

            <div className="grid gap-6 xl:grid-cols-[1.4fr_0.95fr]">
                <BankGlassCard className="relative overflow-hidden rounded-[2rem] border-white/10 bg-[linear-gradient(135deg,rgba(8,15,32,0.94),rgba(18,29,58,0.86))] shadow-[0_30px_70px_rgba(2,6,23,0.38)]">
                    <div className="absolute -right-16 top-0 h-48 w-48 rounded-full bg-primary/16 blur-3xl" />
                    <div className="absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-violet-500/12 blur-3xl" />
                    <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">
                                <Sparkles size={12} />
                                Premium banka görünümü
                            </div>
                            <p className="bank-section-label mb-3 text-[11px]">Toplam Kullanılabilir Bakiye</p>
                            <div className="flex items-center gap-3">
                                <h2 className="font-display text-5xl font-black tracking-[-0.07em] text-white sm:text-6xl">{maskedBalance}</h2>
                                <button type="button" onClick={() => setShowBalance((current) => !current)} className="bank-icon-button shrink-0">
                                    {showBalance ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
                                Akıllı özet paneli; vadesiz, döviz ve bağlı kart bakiyelerini tek premium yüzeyde toplar.
                            </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 lg:w-[18rem]">
                            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                                <p className="bank-section-label mb-2 text-[11px]">Aktif Hesap</p>
                                <p className="text-lg font-bold text-white">{accounts.length}</p>
                                <p className="mt-1 text-sm text-[var(--text-secondary)]">Bireysel portföy</p>
                            </div>
                            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                                <p className="bank-section-label mb-2 text-[11px]">Son 7 Gün</p>
                                <p className="text-lg font-bold text-emerald-300">+2.4%</p>
                                <p className="mt-1 text-sm text-[var(--text-secondary)]">Net büyüme</p>
                            </div>
                        </div>
                    </div>
                </BankGlassCard>

                <BankSectionCard
                    title="Hızlı İşlemler"
                    description="Günlük bankacılık akışlarını tek tıkla başlat."
                >
                    <div className="grid gap-3 sm:grid-cols-2">
                        <BankActionTile icon={Send} title="Para Gönder" description="IBAN, hesap veya kolay adres ile anında transfer." to="/customer/transfer" tone="primary" />
                        <BankActionTile icon={HandCoins} title="Para İste" description="Kişilerinden ödeme talebi oluştur ve takip et." to="/customer/payment-requests" tone="success" />
                        <BankActionTile icon={QrCode} title="QR İşlemleri" description="Mobilden okut, hızlı tahsilat veya ödeme yap." to="/customer/qr" tone="secondary" />
                        <BankActionTile icon={ReceiptText} title="Fatura Öde" description="Düzenli ödemelerini güvenli şekilde yönetin." to="/customer/bills" tone="warning" />
                    </div>
                </BankSectionCard>
            </div>

            {!customer ? (
                <BankSectionCard
                    title="Profilini tamamla"
                    description="Hesap açılışı ve güvenli bankacılık özellikleri için kimlik profilin tamamlanmalı."
                >
                    <form onSubmit={createCustomer} className="grid gap-4 lg:grid-cols-2">
                        {onboardingFields.map((field) => (
                            <label key={field.key} className={field.key === "address" ? "lg:col-span-2" : ""}>
                                <span className="form-label">{field.label}</span>
                                <input
                                    type={field.type}
                                    className="form-input"
                                    placeholder={field.placeholder}
                                    value={customerForm[field.key]}
                                    onChange={(event) => setCustomerForm((current) => ({ ...current, [field.key]: event.target.value }))}
                                    required={field.key !== "address"}
                                    maxLength={field.key === "national_id" ? 11 : undefined}
                                />
                            </label>
                        ))}
                        <div className="lg:col-span-2 flex flex-wrap items-center gap-3 pt-2">
                            <button type="submit" className="bank-primary-btn">
                                <Plus size={18} />
                                Profili Oluştur
                            </button>
                            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300">
                                <AlertCircle size={14} />
                                Bilgiler bankacılık süreçleri için doğrulanır.
                            </div>
                        </div>
                    </form>
                </BankSectionCard>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-3">
                        <BankMetricCard icon={Wallet} label="Toplam Bakiye" value={formatCurrency(totalBalance)} delta="Müşteri varlık toplamı" tone="primary" />
                        <BankMetricCard icon={Landmark} label="Ana Hesap" value={accounts[0]?.account_type === "savings" ? "Tasarruf" : "Vadesiz"} delta={accounts[0]?.iban ? `${accounts[0].iban.slice(0, 8)}…` : "Henüz hesap yok"} tone="secondary" />
                        <BankMetricCard icon={ShieldCheck} label="Güvenlik" value={customer?.status === "active" ? "Aktif" : "İnceleniyor"} delta="Bankacılık koruması açık" tone="success" />
                    </div>

                    <BankSectionCard title="Hesaplarım" description="Her hesabın bakiyesini ve kart eşleşmesini tek panelde gör.">
                        <div className="grid gap-4 md:grid-cols-2">
                            {accounts.length === 0 ? (
                                <BankEmptyState icon={Wallet} title="Henüz hesap bulunmuyor" description="İlk hesabını oluşturduğunda burada görünür." />
                            ) : accounts.map((account, index) => {
                                const accountId = account.id || account.account_id;
                                const currency = account.currency || "TRY";
                                const balance = balances[accountId] || 0;
                                return (
                                    <BankGlassCard key={accountId} className="relative overflow-hidden rounded-[1.7rem] border-white/8 bg-white/[0.03]">
                                        <div className={`absolute inset-x-0 top-0 h-1 ${index % 2 === 0 ? "bg-primary" : "bg-violet-400"}`} />
                                        <p className="bank-section-label mb-3 text-[11px]">{account.account_name || (account.account_type === "savings" ? "Tasarruf Hesabı" : "TRY Vadesiz")}</p>
                                        <h3 className="font-display text-3xl font-black tracking-[-0.06em] text-[var(--text-primary)]">{formatCurrency(balance, currency)}</h3>
                                        <div className="mt-5 flex items-center justify-between text-sm text-[var(--text-secondary)]">
                                            <span>{account.iban ? `${account.iban.slice(0, 8)} •••• ${account.iban.slice(-4)}` : (account.account_number || "")}</span>
                                            <Link to="/customer/accounts" className="text-primary no-underline">Detay</Link>
                                        </div>
                                    </BankGlassCard>
                                );
                            })}
                        </div>
                    </BankSectionCard>
                </div>

                <div className="space-y-6">
                    <BankSectionCard title="Harcama Ritmi" description="Son 7 gün trendiyle hesabının temposunu gör.">
                        <div className="flex items-end gap-3">
                            {spendingBars.map((value, index) => (
                                <div key={index} className="flex flex-1 flex-col items-center gap-3">
                                    <div className="relative h-44 w-full overflow-hidden rounded-t-[1.2rem] bg-white/[0.04]">
                                        <div
                                            className="absolute inset-x-0 bottom-0 rounded-t-[1.2rem] bg-gradient-to-t from-primary via-cyan-400 to-blue-200 shadow-[0_0_18px_rgba(59,130,246,0.24)]"
                                            style={{ height: `${value}%` }}
                                        />
                                    </div>
                                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                                        {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cts', 'Paz'][index]}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </BankSectionCard>

                    <BankSectionCard title="Son İşlemler" description="Yeni hareketlerini anlık olarak takip et." action={<Link to="/customer/ledger" className="text-sm font-bold text-primary no-underline">Tümünü Gör</Link>}>
                        <div className="space-y-3">
                            {recentTx.length === 0 ? (
                                <BankEmptyState icon={ReceiptText} title="Henüz hareket bulunmuyor" description="İlk transfer veya ödeme sonrası işlem akışı burada görünür." className="py-8" />
                            ) : recentTx.map((tx, index) => {
                                const isCredit = tx.direction === "CREDIT" || tx.type === "CREDIT";
                                return (
                                    <div key={tx.id || tx.entry_id || index} className="flex grid-cols-[1fr_auto] items-center gap-4 py-1">
                                        <BankListRow
                                            leading={
                                                <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${isCredit ? "bg-emerald-500/14 text-emerald-400" : "bg-rose-500/14 text-rose-400"}`}>
                                                    {isCredit ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
                                                </span>
                                            }
                                            title={tx.description || (isCredit ? "Gelen transfer" : "Giden işlem")}
                                            description={new Date(tx.created_at).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}
                                            trailing={<span className={isCredit ? "amount-credit" : "amount-debit"}>{`${isCredit ? "+" : "-"}${formatCurrency(Math.abs(tx.amount || 0), tx.currency || "TRY")}`}</span>}
                                            className="flex-1 border-none bg-transparent"
                                        />
                                        <button 
                                            title="Dekontu Görüntüle"
                                            onClick={() => setSelectedTx(tx)}
                                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-[var(--text-secondary)] transition-colors hover:bg-white/10 hover:text-white"
                                        >
                                            <ReceiptText size={16} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </BankSectionCard>
                </div>
            </div>

            {/* Receipt Modal */}
            <TransactionReceipt 
                transaction={selectedTx} 
                onPreviewClose={() => setSelectedTx(null)} 
            />
        </div>
    );
}
