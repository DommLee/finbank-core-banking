import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
    ArrowDownLeft,
    ArrowLeftRight,
    ArrowUpRight,
    CheckCircle,
    Copy,
    Landmark,
    Plus,
    Trash2,
} from "lucide-react";
import { accountApi, transactionApi } from "../services/api";

const TAB_CONFIG = [
    { id: "deposit", label: "Para yatir", icon: ArrowDownLeft, color: "var(--success)" },
    { id: "withdraw", label: "Para cek", icon: ArrowUpRight, color: "var(--danger)" },
    { id: "transfer", label: "Transfer", icon: ArrowLeftRight, color: "var(--accent)" },
];

const ALIAS_TYPE_OPTIONS = [
    { value: "phone", label: "Telefon" },
    { value: "email", label: "E-posta" },
    { value: "national_id", label: "TC Kimlik" },
];

export default function TransferPage() {
    const [accounts, setAccounts] = useState([]);
    const [easyAddresses, setEasyAddresses] = useState([]);
    const [balances, setBalances] = useState({});
    const [activeTab, setActiveTab] = useState("transfer");
    const [loading, setLoading] = useState(false);
    const [bootLoading, setBootLoading] = useState(true);
    const [receipt, setReceipt] = useState(null);
    const [depositForm, setDepositForm] = useState({ account_id: "", amount: "", description: "" });
    const [withdrawForm, setWithdrawForm] = useState({ account_id: "", amount: "", description: "" });
    const [transferForm, setTransferForm] = useState({ from_account_id: "", target: "", amount: "", description: "" });
    const [aliasForm, setAliasForm] = useState({ account_id: "", alias_type: "phone", alias_value: "", label: "" });
    const [aliasSaving, setAliasSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const totalBalance = useMemo(
        () => Object.values(balances).reduce((sum, value) => sum + Number(value || 0), 0),
        [balances]
    );

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
                const accountId = account.id || account.account_id;
                nextBalances[accountId] = Number(account.balance || 0);
            }
            setBalances(nextBalances);

            if (!depositForm.account_id && nextAccounts[0]) {
                const accountId = nextAccounts[0].id || nextAccounts[0].account_id;
                setDepositForm((prev) => ({ ...prev, account_id: accountId }));
                setWithdrawForm((prev) => ({ ...prev, account_id: accountId }));
                setTransferForm((prev) => ({ ...prev, from_account_id: accountId }));
                setAliasForm((prev) => ({ ...prev, account_id: accountId }));
            }
        } catch (error) {
            toast.error("Hesap ve kolay adres verileri yuklenemedi.");
            setAccounts([]);
            setEasyAddresses([]);
            setBalances({});
        } finally {
            setBootLoading(false);
        }
    };

    const showReceipt = (type, amount, description, targetLabel = "") => {
        setReceipt({
            type,
            amount: Number(amount),
            description,
            targetLabel,
            date: new Date().toLocaleString("tr-TR"),
            ref: `FIN-${Date.now().toString(36).toUpperCase()}`,
        });
    };

    const handleDeposit = async (event) => {
        event.preventDefault();
        setLoading(true);
        try {
            await transactionApi.deposit({
                ...depositForm,
                amount: Number(depositForm.amount),
            });
            showReceipt("Para yatirma", depositForm.amount, depositForm.description);
            setDepositForm((prev) => ({ ...prev, amount: "", description: "" }));
            await loadData();
        } catch (error) {
            toast.error(error.response?.data?.detail || "Para yatirma basarisiz.");
        } finally {
            setLoading(false);
        }
    };

    const handleWithdraw = async (event) => {
        event.preventDefault();
        setLoading(true);
        try {
            await transactionApi.withdraw({
                ...withdrawForm,
                amount: Number(withdrawForm.amount),
            });
            showReceipt("Para cekme", withdrawForm.amount, withdrawForm.description);
            setWithdrawForm((prev) => ({ ...prev, amount: "", description: "" }));
            await loadData();
        } catch (error) {
            toast.error(error.response?.data?.detail || "Para cekme basarisiz.");
        } finally {
            setLoading(false);
        }
    };

    const handleTransfer = async (event) => {
        event.preventDefault();
        setLoading(true);
        try {
            const target = transferForm.target.trim();
            const payload = {
                from_account_id: transferForm.from_account_id,
                amount: Number(transferForm.amount),
                description: transferForm.description,
            };
            if (target.toUpperCase().startsWith("TR")) {
                payload.target_iban = target;
            } else if (/^[a-f\d]{24}$/i.test(target)) {
                payload.to_account_id = target;
            } else {
                payload.target_alias = target;
            }
            await transactionApi.transfer(payload);
            showReceipt("Transfer", transferForm.amount, transferForm.description, target);
            setTransferForm((prev) => ({ ...prev, target: "", amount: "", description: "" }));
            await loadData();
        } catch (error) {
            toast.error(error.response?.data?.detail || "Transfer basarisiz.");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateAlias = async (event) => {
        event.preventDefault();
        setAliasSaving(true);
        try {
            await accountApi.createEasyAddress(aliasForm);
            toast.success("Kolay adres kaydedildi.");
            setAliasForm((prev) => ({ ...prev, alias_value: "", label: "" }));
            await loadData();
        } catch (error) {
            toast.error(error.response?.data?.detail || "Kolay adres kaydedilemedi.");
        } finally {
            setAliasSaving(false);
        }
    };

    const handleDeleteAlias = async (id) => {
        try {
            await accountApi.deleteEasyAddress(id);
            toast.success("Kolay adres silindi.");
            await loadData();
        } catch (error) {
            toast.error(error.response?.data?.detail || "Kolay adres silinemedi.");
        }
    };

    if (bootLoading) {
        return <div className="loading-container"><div className="spinner" /></div>;
    }

    if (receipt) {
        return (
            <div>
                <div className="page-header" style={{ textAlign: "center" }}>
                    <h1>Islem tamamlandi</h1>
                </div>
                <div className="card" style={{ maxWidth: 460, margin: "0 auto", textAlign: "center", padding: 32 }}>
                    <div style={{ width: 66, height: 66, borderRadius: "50%", margin: "0 auto 16px", background: "rgba(34,197,94,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <CheckCircle size={34} style={{ color: "var(--success)" }} />
                    </div>
                    <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Basarili</h2>
                    <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>{receipt.type} islemi tamamlandi.</p>
                    <div style={{ fontSize: 34, fontWeight: 900, marginBottom: 24 }}>{formatMoney(receipt.amount)}</div>
                    <div style={{ background: "var(--bg-secondary)", borderRadius: 14, padding: 16, textAlign: "left", marginBottom: 20 }}>
                        <ReceiptRow label="Islem" value={receipt.type} />
                        <ReceiptRow label="Tarih" value={receipt.date} />
                        <ReceiptRow label="Referans" value={receipt.ref} copyable />
                        {receipt.targetLabel ? <ReceiptRow label="Alici" value={receipt.targetLabel} /> : null}
                        {receipt.description ? <ReceiptRow label="Aciklama" value={receipt.description} /> : null}
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setReceipt(null)}>Yeni islem</button>
                        <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => (window.location.href = "/customer/ledger")}>Hesap defteri</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ paddingBottom: 64 }}>
            <div className="page-header" style={{ textAlign: "center", marginBottom: 28 }}>
                <h1 style={{ fontSize: 34, fontWeight: 900, letterSpacing: -1 }}>Transfer ve para islemleri</h1>
                <p style={{ fontSize: 16 }}>Kolay adres, IBAN ve hesap no ile para hareketlerinizi yonetin.</p>
            </div>

            <div className="card" style={{ marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Toplam bakiye</div>
                    <div style={{ fontSize: 28, fontWeight: 900 }}>{formatMoney(totalBalance)}</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {accounts.map((account) => (
                        <div key={account.id || account.account_id} style={{ padding: "8px 12px", borderRadius: 12, background: "var(--bg-secondary)", fontSize: 12, fontWeight: 600 }}>
                            {account.account_number} - {formatMoney(account.balance)}
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 24, background: "var(--bg-input)", padding: 8, borderRadius: "var(--radius-full)", flexWrap: "wrap" }}>
                {TAB_CONFIG.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            flex: 1,
                            minWidth: 120,
                            padding: "14px 10px",
                            borderRadius: "var(--radius-full)",
                            border: "none",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            fontWeight: 800,
                            background: activeTab === tab.id ? tab.color : "transparent",
                            color: activeTab === tab.id ? "#fff" : "var(--text-muted)",
                        }}
                    >
                        <tab.icon size={18} /> {tab.label}
                    </button>
                ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
                <div className="card">
                    {activeTab === "deposit" ? (
                        <MoneyForm
                            title="Hesaba para yatir"
                            submitLabel={loading ? "Isleniyor" : "Parayi yatir"}
                            submitClass="btn btn-success"
                            form={depositForm}
                            setForm={setDepositForm}
                            accounts={accounts}
                            balances={balances}
                            loading={loading}
                            mode="deposit"
                            onSubmit={handleDeposit}
                        />
                    ) : null}

                    {activeTab === "withdraw" ? (
                        <MoneyForm
                            title="Hesaptan para cek"
                            submitLabel={loading ? "Isleniyor" : "Parayi cek"}
                            submitClass="btn btn-danger"
                            form={withdrawForm}
                            setForm={setWithdrawForm}
                            accounts={accounts}
                            balances={balances}
                            loading={loading}
                            mode="withdraw"
                            onSubmit={handleWithdraw}
                        />
                    ) : null}

                    {activeTab === "transfer" ? (
                        <form onSubmit={handleTransfer}>
                            <h3 style={sectionTitleStyle}>Kolay transfer</h3>
                            <div className="form-group">
                                <label className="form-label">Gonderen hesap</label>
                                <select className="form-select" value={transferForm.from_account_id} onChange={(event) => setTransferForm((prev) => ({ ...prev, from_account_id: event.target.value }))} required>
                                    <option value="">Hesap secin</option>
                                    {accounts.map((account) => {
                                        const accountId = account.id || account.account_id;
                                        return (
                                            <option key={accountId} value={accountId}>
                                                {account.account_number} - {formatMoney(balances[accountId])}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Alici</label>
                                <input
                                    className="form-input"
                                    placeholder="IBAN, hesap no, telefon, e-posta veya TC Kimlik"
                                    value={transferForm.target}
                                    onChange={(event) => setTransferForm((prev) => ({ ...prev, target: event.target.value }))}
                                    required
                                />
                            </div>
                            {easyAddresses.length > 0 ? (
                                <div style={{ marginBottom: 18 }}>
                                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>Kayitli kolay adresler</div>
                                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                        {easyAddresses.map((easyAddress) => (
                                            <button
                                                key={easyAddress.id}
                                                type="button"
                                                onClick={() => setTransferForm((prev) => ({ ...prev, target: easyAddress.alias_value }))}
                                                style={easyAddressChipStyle}
                                            >
                                                {easyAddress.label || easyAddress.alias_type} - {easyAddress.masked_value || easyAddress.alias_value}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                            <div className="form-group">
                                <label className="form-label">Tutar</label>
                                <input className="form-input" type="number" min="0.01" step="0.01" value={transferForm.amount} onChange={(event) => setTransferForm((prev) => ({ ...prev, amount: event.target.value }))} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Aciklama</label>
                                <input className="form-input" value={transferForm.description} onChange={(event) => setTransferForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Ornek: kira, yemek, borc iadesi" />
                            </div>
                            <button className="btn btn-primary" disabled={loading} style={{ width: "100%" }}>
                                {loading ? "Isleniyor" : "Transfer et"}
                            </button>
                        </form>
                    ) : null}
                </div>

                <div style={{ display: "grid", gap: 16 }}>
                    <div className="card">
                        <h3 style={sectionTitleStyle}>Kolay adres defteri</h3>
                        {easyAddresses.length === 0 ? (
                            <EmptyState message="Henuz kolay adres kayitli degil. Telefon, e-posta veya TC ile kayit ekleyebilirsiniz." />
                        ) : (
                            <div style={{ display: "grid", gap: 10 }}>
                                {easyAddresses.map((easyAddress) => (
                                    <div key={easyAddress.id} style={aliasCardStyle}>
                                        <div>
                                            <div style={{ fontWeight: 700 }}>{easyAddress.label || easyAddress.alias_type}</div>
                                            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                                                {easyAddress.alias_type} - {easyAddress.masked_value || easyAddress.alias_value}
                                            </div>
                                            {easyAddress.account ? (
                                                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                                                    {easyAddress.account.account_number} - {easyAddress.account.currency}
                                                </div>
                                            ) : null}
                                        </div>
                                        <button type="button" onClick={() => handleDeleteAlias(easyAddress.id)} style={deleteButtonStyle}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="card">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                            <h3 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Yeni kolay adres</h3>
                        </div>
                        <p style={{ color: "var(--text-secondary)", marginBottom: 20, fontSize: 14 }}>
                            IBAN ezberlemeye son! Para transferlerini kolaylaştırmak için telefon, e-posta veya TC Kimlik numaranızı bir hesabınıza bağlayın.
                        </p>
                        <button
                            className="btn btn-outline"
                            type="button"
                            onClick={() => window.location.href = "/customer/easy-address"}
                            style={{ width: "100%", display: "flex", justifyContent: "center", gap: 8, padding: "12px 0" }}
                        >
                            <Plus size={18} /> Kolay Adres Yönetimi
                        </button>
                    </div>

                    <div className="card">
                        <h3 style={sectionTitleStyle}>Hesap ozetiniz</h3>
                        {accounts.length === 0 ? <EmptyState message="Henuz aktif hesabiniz yok." /> : accounts.map((account) => {
                            const accountId = account.id || account.account_id;
                            return (
                                <div key={accountId} style={summaryRowStyle}>
                                    <div>
                                        <div style={{ fontWeight: 700 }}>{account.account_number}</div>
                                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{account.iban}</div>
                                    </div>
                                    <div style={{ fontWeight: 800 }}>{formatMoney(balances[accountId])}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

function MoneyForm({ title, submitLabel, submitClass, form, setForm, accounts, balances, loading, mode, onSubmit }) {
    return (
        <form onSubmit={onSubmit}>
            <h3 style={sectionTitleStyle}>{title}</h3>
            <div className="form-group">
                <label className="form-label">Hesap</label>
                <select className="form-select" value={form.account_id} onChange={(event) => setForm((prev) => ({ ...prev, account_id: event.target.value }))} required>
                    <option value="">Hesap secin</option>
                    {accounts.map((account) => {
                        const accountId = account.id || account.account_id;
                        return (
                            <option key={accountId} value={accountId}>
                                {account.account_number} - {formatMoney(balances[accountId])}
                            </option>
                        );
                    })}
                </select>
            </div>
            <div className="form-group">
                <label className="form-label">Tutar</label>
                <input className="form-input" type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))} required />
            </div>
            <div className="form-group">
                <label className="form-label">Aciklama</label>
                <input className="form-input" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder={mode === "deposit" ? "Ornek: maas, havale" : "Ornek: ATM, nakit cekim"} />
            </div>
            <button className={submitClass} disabled={loading} style={{ width: "100%" }}>{submitLabel}</button>
        </form>
    );
}

function EmptyState({ message }) {
    return (
        <div style={{ padding: 18, borderRadius: 14, background: "var(--bg-secondary)", color: "var(--text-secondary)", textAlign: "center" }}>
            <Landmark size={28} style={{ marginBottom: 10, opacity: 0.7 }} />
            <div style={{ fontSize: 13 }}>{message}</div>
        </div>
    );
}

function ReceiptRow({ label, value, copyable = false }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border-color)" }}>
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                {value}
                {copyable ? (
                    <button type="button" onClick={() => { navigator.clipboard.writeText(value); toast.success("Kopyalandi."); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)" }}>
                        <Copy size={14} />
                    </button>
                ) : null}
            </span>
        </div>
    );
}

function formatMoney(value) {
    return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(Number(value || 0));
}

const sectionTitleStyle = {
    fontSize: 22,
    fontWeight: 800,
    marginBottom: 20,
};

const easyAddressChipStyle = {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid var(--border-color)",
    background: "var(--bg-secondary)",
    color: "var(--text-primary)",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 12,
};

const aliasCardStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    background: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
};

const deleteButtonStyle = {
    width: 34,
    height: 34,
    borderRadius: 10,
    border: "1px solid var(--border-color)",
    background: "var(--bg-card)",
    color: "#ef4444",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
};

const summaryRowStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "12px 0",
    borderBottom: "1px solid var(--border-color)",
};


