import { useEffect, useState } from "react";
import { CheckCircle2, Copy, Eye, EyeOff, Landmark, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { accountApi } from "../services/api";

const ACCOUNT_TYPE_LABELS = {
    checking: "Vadesiz hesap",
    savings: "Tasarruf hesabi",
};

const CURRENCY_COLORS = {
    TRY: ["#0f172a", "#1d4ed8"],
    USD: ["#052e16", "#10b981"],
    EUR: ["#312e81", "#7c3aed"],
};

export default function AccountsPage() {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [visibleIban, setVisibleIban] = useState({});
    const [copiedValue, setCopiedValue] = useState("");
    const [newAccount, setNewAccount] = useState({ account_type: "checking", currency: "TRY" });

    useEffect(() => {
        loadAccounts();
    }, []);

    const loadAccounts = async () => {
        setLoading(true);
        try {
            const res = await accountApi.listMine();
            setAccounts(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            toast.error("Hesaplar yuklenemedi.");
            setAccounts([]);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (event) => {
        event.preventDefault();
        try {
            await accountApi.create(newAccount);
            toast.success("Yeni hesap olusturuldu.");
            setShowModal(false);
            await loadAccounts();
        } catch (error) {
            toast.error(error.response?.data?.detail || "Hesap acilamadi.");
        }
    };

    const handleCopy = async (value, label) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopiedValue(value);
            toast.success(`${label} kopyalandi.`);
            setTimeout(() => setCopiedValue(""), 1800);
        } catch {
            toast.error("Kopyalama basarisiz.");
        }
    };

    const toggleIban = (accountId) => {
        setVisibleIban((prev) => ({ ...prev, [accountId]: !prev[accountId] }));
    };

    if (loading) {
        return <div className="loading-container"><div className="spinner" /></div>;
    }

    return (
        <div style={{ paddingBottom: 72 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
                <div>
                    <h1 style={{ fontSize: 34, fontWeight: 900, letterSpacing: -1, margin: 0 }}>Hesaplarim</h1>
                    <p style={{ margin: "8px 0 0", color: "var(--text-secondary)" }}>
                        IBAN, hesap numarasi ve bakiye bilgilerinizi tek ekranda yonetin.
                    </p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ borderRadius: "var(--radius-full)", padding: "14px 24px", fontSize: 16, fontWeight: 800 }}>
                    <Plus size={20} style={{ marginRight: 8 }} /> Yeni hesap ac
                </button>
            </div>

            {accounts.length === 0 ? (
                <div className="empty-state">
                    <Landmark size={52} style={{ opacity: 0.32 }} />
                    <p style={{ marginTop: 12 }}>Henuz hesabiniz yok. Yeni hesap olusturarak para transferine baslayabilirsiniz.</p>
                </div>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
                    {accounts.map((account, index) => {
                        const accountId = account.id || account.account_id;
                        const gradient = CURRENCY_COLORS[account.currency] || ["#111827", "#334155"];
                        const maskedIban = maskIban(account.iban);
                        const balance = Number(account.balance || 0);
                        return (
                            <div
                                key={accountId || index}
                                style={{
                                    borderRadius: 28,
                                    padding: 28,
                                    color: "#f8fafc",
                                    position: "relative",
                                    overflow: "hidden",
                                    background: `linear-gradient(135deg, ${gradient[0]} 0%, ${gradient[1]} 100%)`,
                                    boxShadow: "0 24px 48px rgba(15, 23, 42, 0.24)",
                                }}
                            >
                                <div style={{ position: "absolute", right: -24, top: -36, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.12)" }} />
                                <div style={{ position: "absolute", left: -30, bottom: -42, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />

                                <div style={{ position: "relative", zIndex: 1 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                                        <div>
                                            <div style={{ fontSize: 12, opacity: 0.78, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1.2 }}>
                                                {ACCOUNT_TYPE_LABELS[account.account_type] || "Banka hesabi"}
                                            </div>
                                            <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.8 }}>
                                                {balance.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {account.currency}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: "right" }}>
                                            <div style={{ fontSize: 12, opacity: 0.72 }}>Durum</div>
                                            <div style={{ fontWeight: 700, fontSize: 13 }}>
                                                {account.status === "active" ? "Aktif" : account.status === "frozen" ? "Donduruldu" : "Pasif"}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ marginTop: 32, marginBottom: 24 }}>
                                        <div style={{ fontSize: 11, opacity: 0.74, textTransform: "uppercase", letterSpacing: 1.2 }}>Hesap numarasi</div>
                                        <div style={{ fontFamily: "monospace", fontSize: 22, letterSpacing: 3, fontWeight: 700, marginTop: 8 }}>
                                            {formatAccountNumber(account.account_number)}
                                        </div>
                                    </div>

                                    <div style={{ display: "grid", gap: 14 }}>
                                        <DetailRow
                                            label="IBAN"
                                            value={visibleIban[accountId] ? account.iban : maskedIban}
                                            action={
                                                <button type="button" onClick={() => toggleIban(accountId)} style={ghostButtonStyle}>
                                                    {visibleIban[accountId] ? <EyeOff size={14} /> : <Eye size={14} />}
                                                    {visibleIban[accountId] ? "Gizle" : "Goster"}
                                                </button>
                                            }
                                        />
                                        <DetailRow
                                            label="Kopyala"
                                            value={copiedValue === account.iban ? "IBAN kopyalandi" : copiedValue === account.account_number ? "Hesap no kopyalandi" : "Hesap bilgilerini kopyalayin"}
                                            action={
                                                <div style={{ display: "flex", gap: 8 }}>
                                                    <button type="button" onClick={() => handleCopy(account.account_number, "Hesap numarasi")} style={ghostButtonStyle}>
                                                        <Copy size={14} /> Hesap no
                                                    </button>
                                                    <button type="button" onClick={() => handleCopy(account.iban, "IBAN")} style={ghostButtonStyle}>
                                                        {copiedValue === account.iban ? <CheckCircle2 size={14} /> : <Copy size={14} />} IBAN
                                                    </button>
                                                </div>
                                            }
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(event) => event.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Yeni hesap ac</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>X</button>
                        </div>
                        <form onSubmit={handleCreate}>
                            <div className="form-group">
                                <label className="form-label">Hesap tipi</label>
                                <select
                                    className="form-select"
                                    value={newAccount.account_type}
                                    onChange={(event) => setNewAccount((prev) => ({ ...prev, account_type: event.target.value }))}
                                >
                                    <option value="checking">Vadesiz hesap</option>
                                    <option value="savings">Tasarruf hesabi</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Para birimi</label>
                                <select
                                    className="form-select"
                                    value={newAccount.currency}
                                    onChange={(event) => setNewAccount((prev) => ({ ...prev, currency: event.target.value }))}
                                >
                                    <option value="TRY">TRY</option>
                                    <option value="USD">USD</option>
                                    <option value="EUR">EUR</option>
                                </select>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                                    Vazgec
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Hesap ac
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function DetailRow({ label, value, action }) {
    return (
        <div style={{
            background: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.16)",
            backdropFilter: "blur(10px)",
            borderRadius: 16,
            padding: "14px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
        }}>
            <div>
                <div style={{ fontSize: 11, opacity: 0.7, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
                <div style={{ fontFamily: label === "IBAN" ? "monospace" : "inherit", fontSize: 13, fontWeight: 600, marginTop: 4 }}>{value}</div>
            </div>
            {action}
        </div>
    );
}

function maskIban(iban) {
    if (!iban) return "";
    if (iban.length <= 8) return iban;
    return `${iban.slice(0, 4)} ${"*".repeat(Math.max(iban.length - 8, 0))} ${iban.slice(-4)}`;
}

function formatAccountNumber(value) {
    if (!value) return "";
    return value.replace(/(.{4})/g, "$1 ").trim();
}

const ghostButtonStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
    color: "#f8fafc",
    cursor: "pointer",
    fontWeight: 600,
};
