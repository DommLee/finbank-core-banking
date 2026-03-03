import { useState, useEffect } from "react";
import { accountApi, transactionApi } from "../services/api";
import toast from "react-hot-toast";
import {
    ArrowDownLeft, ArrowUpRight, ArrowLeftRight,
    CheckCircle, Copy, X,
} from "lucide-react";

export default function TransferPage() {
    const [accounts, setAccounts] = useState([]);
    const [balances, setBalances] = useState({});
    const [activeTab, setActiveTab] = useState("deposit");
    const [loading, setLoading] = useState(false);
    const [receipt, setReceipt] = useState(null); // success receipt

    const [depositForm, setDepositForm] = useState({ account_id: "", amount: "", description: "" });
    const [withdrawForm, setWithdrawForm] = useState({ account_id: "", amount: "", description: "" });
    const [transferForm, setTransferForm] = useState({
        from_account_id: "", to_account_id: "", amount: "", description: "",
    });

    useEffect(() => {
        loadAccounts();
    }, []);

    const loadAccounts = async () => {
        try {
            const res = await accountApi.listMine();
            setAccounts(res.data);
            const bMap = {};
            for (const acc of res.data) {
                try {
                    const b = await accountApi.getBalance(acc.id);
                    bMap[acc.id] = b.data.balance;
                } catch { bMap[acc.id] = 0; }
            }
            setBalances(bMap);
        } catch {
            toast.error("Hesaplar yüklenemedi");
        }
    };

    const showReceipt = (type, amount, desc) => {
        setReceipt({
            type,
            amount: parseFloat(amount),
            description: desc,
            date: new Date().toLocaleString("tr-TR"),
            ref: "FIN-" + Date.now().toString(36).toUpperCase(),
        });
    };

    const handleDeposit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await transactionApi.deposit({
                ...depositForm,
                amount: parseFloat(depositForm.amount),
            });
            showReceipt("Para Yatırma", depositForm.amount, depositForm.description);
            setDepositForm({ account_id: depositForm.account_id, amount: "", description: "" });
            loadAccounts();
        } catch (err) {
            toast.error(err.response?.data?.detail || "İşlem başarısız");
        } finally {
            setLoading(false);
        }
    };

    const handleWithdraw = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await transactionApi.withdraw({
                ...withdrawForm,
                amount: parseFloat(withdrawForm.amount),
            });
            showReceipt("Para Çekme", withdrawForm.amount, withdrawForm.description);
            setWithdrawForm({ account_id: withdrawForm.account_id, amount: "", description: "" });
            loadAccounts();
        } catch (err) {
            toast.error(err.response?.data?.detail || "İşlem başarısız");
        } finally {
            setLoading(false);
        }
    };

    const handleTransfer = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const target = transferForm.to_account_id.trim();
            const payload = {
                from_account_id: transferForm.from_account_id,
                amount: parseFloat(transferForm.amount),
                description: transferForm.description,
            };
            if (target.toUpperCase().startsWith("TR")) {
                payload.target_iban = target;
            } else {
                payload.to_account_id = target;
            }

            await transactionApi.transfer(payload);
            showReceipt("Havale", transferForm.amount, transferForm.description);
            setTransferForm({
                from_account_id: transferForm.from_account_id,
                to_account_id: "", amount: "", description: "",
            });
            loadAccounts();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Transfer başarısız");
        } finally {
            setLoading(false);
        }
    };

    const tabs = [
        { id: "deposit", label: "Yatır", icon: ArrowDownLeft, color: "var(--success)" },
        { id: "withdraw", label: "Çek", icon: ArrowUpRight, color: "var(--danger)" },
        { id: "transfer", label: "Havale", icon: ArrowLeftRight, color: "var(--accent)" },
    ];

    // ── Receipt Modal ──
    if (receipt) {
        return (
            <div>
                <div className="page-header" style={{ textAlign: "center" }}>
                    <h1>İşlem Tamamlandı</h1>
                </div>
                <div className="card" style={{ maxWidth: 440, margin: "0 auto", textAlign: "center", padding: 32 }}>
                    <div style={{
                        width: 64, height: 64, borderRadius: "50%", margin: "0 auto 16px",
                        background: "rgba(34, 197, 94, 0.1)", display: "flex",
                        alignItems: "center", justifyContent: "center",
                    }}>
                        <CheckCircle size={32} style={{ color: "var(--success)" }} />
                    </div>

                    <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Başarılı!</h2>
                    <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24 }}>
                        {receipt.type} işleminiz başarıyla tamamlandı.
                    </p>

                    <div style={{
                        fontSize: 36, fontWeight: 800, marginBottom: 24,
                        color: "var(--text-primary)",
                    }}>
                        {receipt.amount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
                    </div>

                    <div style={{
                        background: "var(--bg-tertiary)", borderRadius: 12, padding: 16,
                        textAlign: "left", marginBottom: 24,
                    }}>
                        <ReceiptRow label="İşlem Tipi" value={receipt.type} />
                        <ReceiptRow label="Tarih" value={receipt.date} />
                        <ReceiptRow label="Referans" value={receipt.ref} copyable />
                        {receipt.description && <ReceiptRow label="Açıklama" value={receipt.description} />}
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                        <button className="btn btn-primary" style={{ flex: 1 }}
                            onClick={() => setReceipt(null)}>
                            Yeni İşlem
                        </button>
                        <button className="btn btn-outline" style={{ flex: 1 }}
                            onClick={() => {
                                setReceipt(null);
                                window.location.href = "/customer/ledger";
                            }}>
                            Hesap Defteri
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ paddingBottom: 60 }}>
            <div className="page-header" style={{ textAlign: "center", marginBottom: 32 }}>
                <h1 style={{ fontSize: 36, fontWeight: 900, letterSpacing: -1 }}>İşlemler 💸</h1>
                <p style={{ fontSize: 16 }}>Ne yapmak istersin?</p>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 12, marginBottom: 36, background: "var(--bg-input)", padding: 8, borderRadius: "var(--radius-full)" }}>
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            flex: 1, padding: "16px 8px", borderRadius: "var(--radius-full)", border: "none",
                            fontWeight: 800, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center",
                            justifyContent: "center", gap: 8, transition: "var(--transition)",
                            background: activeTab === tab.id ? tab.color : "transparent",
                            color: activeTab === tab.id ? "white" : "var(--text-muted)",
                            boxShadow: activeTab === tab.id ? "0 4px 16px rgba(0,0,0,0.2)" : "none"
                        }}
                    >
                        <tab.icon size={20} /> <span style={{ display: "inline-block" }}>{tab.label}</span>
                    </button>
                ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
                {/* ── Form ── */}
                <div className="card">
                    {activeTab === "deposit" && (
                        <form onSubmit={handleDeposit}>
                            <h3 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24, textAlign: "center" }}>Gelen Para Miktarı</h3>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: 16, fontWeight: 700 }}>Hangi Hesaba?</label>
                                <select className="form-select" value={depositForm.account_id}
                                    style={{ fontSize: 18, padding: "16px", borderRadius: 16 }}
                                    onChange={(e) => setDepositForm({ ...depositForm, account_id: e.target.value })}
                                    required>
                                    <option value="">Hesap seçin...</option>
                                    {accounts.map((a) => (
                                        <option key={a.id} value={a.id}>{a.account_number} ({a.currency})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: 16, fontWeight: 700 }}>Tutar (₺)</label>
                                <input className="form-input" type="number" step="0.01" min="0.01"
                                    style={{ fontSize: 32, padding: "20px", borderRadius: 20, textAlign: "center", fontWeight: 900 }}
                                    placeholder="0,00" value={depositForm.amount}
                                    onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })}
                                    required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Açıklama</label>
                                <input className="form-input" placeholder="Maaş yatırma"
                                    value={depositForm.description}
                                    onChange={(e) => setDepositForm({ ...depositForm, description: e.target.value })} />
                            </div>
                            <button className="btn btn-success" disabled={loading} style={{ width: "100%", fontSize: 20 }}>
                                {loading ? "İşleniyor..." : "Yatır"}
                            </button>
                        </form>
                    )}

                    {activeTab === "withdraw" && (
                        <form onSubmit={handleWithdraw}>
                            <h3 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24, textAlign: "center" }}>Çekilecek Miktar</h3>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: 16, fontWeight: 700 }}>Hangi Hesaptan?</label>
                                <select className="form-select" value={withdrawForm.account_id}
                                    style={{ fontSize: 18, padding: "16px", borderRadius: 16 }}
                                    onChange={(e) => setWithdrawForm({ ...withdrawForm, account_id: e.target.value })}
                                    required>
                                    <option value="">Hesap seçin...</option>
                                    {accounts.map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.account_number} — Bakiye: {(balances[a.id] || 0).toLocaleString("tr-TR")} ₺
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: 16, fontWeight: 700 }}>Tutar (₺)</label>
                                <input className="form-input" type="number" step="0.01" min="0.01"
                                    style={{ fontSize: 32, padding: "20px", borderRadius: 20, textAlign: "center", fontWeight: 900 }}
                                    placeholder="0,00" value={withdrawForm.amount}
                                    onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })}
                                    required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Açıklama</label>
                                <input className="form-input" placeholder="ATM çekimi"
                                    value={withdrawForm.description}
                                    onChange={(e) => setWithdrawForm({ ...withdrawForm, description: e.target.value })} />
                            </div>
                            <button className="btn btn-danger" disabled={loading} style={{ width: "100%", fontSize: 20 }}>
                                {loading ? "İşleniyor..." : "Çek"}
                            </button>
                        </form>
                    )}

                    {activeTab === "transfer" && (
                        <form onSubmit={handleTransfer}>
                            <h3 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24, textAlign: "center" }}>Kime Göndermek İstersin?</h3>

                            <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 16, marginBottom: 16 }}>
                                {[{ name: "Annem", id: "1" }, { name: "Babam", id: "2" }, { name: "Kardeşim", id: "3" }, { name: "Ev Sahibi", id: "4" }].map(person => (
                                    <div key={person.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 70, cursor: "pointer" }}>
                                        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--accent-glow)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, border: "2px solid var(--accent)" }}>
                                            👤
                                        </div>
                                        <span style={{ fontSize: 13, fontWeight: 600 }}>{person.name}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: 16, fontWeight: 700 }}>Gönderen Hesap</label>
                                <select className="form-select" value={transferForm.from_account_id}
                                    style={{ fontSize: 18, padding: "16px", borderRadius: 16 }}
                                    onChange={(e) => setTransferForm({ ...transferForm, from_account_id: e.target.value })}
                                    required>
                                    <option value="">Hesap seçin...</option>
                                    {accounts.map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.account_number} — {(balances[a.id] || 0).toLocaleString("tr-TR")} ₺
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: 16, fontWeight: 700 }}>Alıcı Hesap ID veya IBAN</label>
                                <input className="form-input" placeholder="TR..."
                                    style={{ fontSize: 18, padding: "16px", borderRadius: 16 }}
                                    value={transferForm.to_account_id}
                                    onChange={(e) => setTransferForm({ ...transferForm, to_account_id: e.target.value })}
                                    required />
                            </div>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: 16, fontWeight: 700 }}>Tutar (₺)</label>
                                <input className="form-input" type="number" step="0.01" min="0.01"
                                    style={{ fontSize: 32, padding: "20px", borderRadius: 20, textAlign: "center", fontWeight: 900 }}
                                    placeholder="0,00" value={transferForm.amount}
                                    onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                                    required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Açıklama</label>
                                <input className="form-input" placeholder="Kira ödemesi"
                                    value={transferForm.description}
                                    onChange={(e) => setTransferForm({ ...transferForm, description: e.target.value })} />
                            </div>
                            <button className="btn btn-primary" disabled={loading} style={{ width: "100%", fontSize: 20 }}>
                                {loading ? "İşleniyor..." : "Transfer Et"}
                            </button>
                        </form>
                    )}
                </div>

                {/* ── Accounts Summary ── */}
                <div>
                    <h3 style={{ fontSize: 16, marginBottom: 12 }}>Hesap Bakiyeleri</h3>
                    {accounts.length === 0 ? (
                        <div className="card" style={{ padding: 24, textAlign: "center" }}>
                            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
                                Henüz banka hesabınız yok.<br />
                                Hesaplar sayfasından yeni hesap açabilirsiniz.
                            </p>
                        </div>
                    ) : (
                        accounts.map((acc) => (
                            <div key={acc.id} className="card" style={{ marginBottom: 8, padding: 16 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{acc.account_number}</div>
                                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                            {acc.account_type === "checking" ? "Vadesiz" : "Tasarruf"} • {acc.currency}
                                        </div>
                                        <div style={{
                                            fontSize: 11, color: "var(--text-muted)",
                                            fontFamily: "monospace", marginTop: 2,
                                        }}>
                                            IBAN: {acc.iban}
                                        </div>
                                    </div>
                                    <div style={{ fontWeight: 700, fontSize: 18 }}>
                                        {(balances[acc.id] || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

function ReceiptRow({ label, value, copyable }) {
    return (
        <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "8px 0", borderBottom: "1px solid var(--border-color)",
        }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                {value}
                {copyable && (
                    <button style={{
                        background: "none", border: "none", padding: 2, cursor: "pointer",
                        color: "var(--accent)",
                    }} onClick={() => {
                        navigator.clipboard.writeText(value);
                        toast.success("Kopyalandı!");
                    }}>
                        <Copy size={13} />
                    </button>
                )}
            </span>
        </div>
    );
}
