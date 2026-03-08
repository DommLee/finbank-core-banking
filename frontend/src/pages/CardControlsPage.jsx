import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
    CreditCard,
    Eye,
    EyeOff,
    Globe2,
    Lock,
    Shield,
    Smartphone,
    Trash2,
    Unlock,
    Wifi,
} from "lucide-react";
import { accountApi, cardApi, cardsApi } from "../services/api";

export default function CardControlsPage() {
    const [accounts, setAccounts] = useState([]);
    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busyKey, setBusyKey] = useState("");
    const [showIban, setShowIban] = useState({});

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [accountsRes, cardsRes] = await Promise.all([
                accountApi.listMine(),
                cardsApi.getMyCards(),
            ]);
            setAccounts(Array.isArray(accountsRes.data) ? accountsRes.data : []);
            setCards(Array.isArray(cardsRes.data) ? cardsRes.data : []);
        } catch (error) {
            toast.error("Kontrol ekranlari yuklenemedi.");
            setAccounts([]);
            setCards([]);
        } finally {
            setLoading(false);
        }
    };

    const toggleAccountFreeze = async (accountId) => {
        setBusyKey(`account-${accountId}`);
        try {
            const res = await cardApi.toggleFreeze(accountId);
            toast.success(res.data.message || "Hesap durumu guncellendi.");
            await loadData();
        } catch (error) {
            toast.error(error.response?.data?.detail || "Hesap durumu guncellenemedi.");
        } finally {
            setBusyKey("");
        }
    };

    const updateCardSetting = async (card, updates) => {
        const cardId = card.id || card.card_id;
        setBusyKey(`card-${cardId}`);
        try {
            await cardsApi.updateSettings(cardId, updates);
            toast.success("Kart ayarlari guncellendi.");
            await loadData();
        } catch (error) {
            toast.error(error.response?.data?.detail || "Kart ayari guncellenemedi.");
        } finally {
            setBusyKey("");
        }
    };

    const toggleCardFreeze = async (card) => {
        const cardId = card.id || card.card_id;
        setBusyKey(`card-freeze-${cardId}`);
        try {
            const res = await cardsApi.toggleFreeze(cardId);
            toast.success(res.data.message || "Kart durumu guncellendi.");
            await loadData();
        } catch (error) {
            toast.error(error.response?.data?.detail || "Kart durumu guncellenemedi.");
        } finally {
            setBusyKey("");
        }
    };

    const deleteVirtualCard = async (card) => {
        const cardId = card.id || card.card_id;
        if (!window.confirm("Bu sanal kart silinsin mi?")) return;
        setBusyKey(`card-delete-${cardId}`);
        try {
            await cardsApi.deleteCard(cardId);
            toast.success("Sanal kart silindi.");
            await loadData();
        } catch (error) {
            toast.error(error.response?.data?.detail || "Sanal kart silinemedi.");
        } finally {
            setBusyKey("");
        }
    };

    const toggleIban = (accountId) => {
        setShowIban((prev) => ({ ...prev, [accountId]: !prev[accountId] }));
    };

    if (loading) {
        return (
            <div className="page-container" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
                <div className="spinner" style={{ width: 40, height: 40 }} />
            </div>
        );
    }

    return (
        <div className="page-container" style={{ maxWidth: 1080 }}>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Kart ve hesap kontrolleri</h1>
                <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: 0 }}>
                    Hesaplarinizi dondurun, kartlarinizin internet alisverisi ve temassiz ayarlarini yonetin.
                </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
                <div style={{ display: "grid", gap: 16 }}>
                    <div className="card">
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                            <Shield size={18} color="#f59e0b" />
                            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Hesap kontrolleri</h2>
                        </div>
                        {accounts.length === 0 ? (
                            <EmptyState message="Henuz hesabiniz yok." />
                        ) : accounts.map((account) => {
                            const accountId = account.id || account.account_id;
                            const isFrozen = account.status === "frozen";
                            return (
                                <div key={accountId} style={panelRowStyle}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 700 }}>{account.account_number}</div>
                                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{account.account_type} - {account.currency}</div>
                                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6, fontFamily: "monospace" }}>
                                            {showIban[accountId] ? account.iban : maskIban(account.iban)}
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                        <button type="button" onClick={() => toggleIban(accountId)} style={secondaryButtonStyle}>
                                            {showIban[accountId] ? <EyeOff size={14} /> : <Eye size={14} />}
                                            {showIban[accountId] ? "Gizle" : "Goster"}
                                        </button>
                                        <button type="button" onClick={() => toggleAccountFreeze(accountId)} disabled={busyKey === `account-${accountId}`} style={statusButtonStyle(isFrozen)}>
                                            {isFrozen ? <Unlock size={14} /> : <Lock size={14} />}
                                            {isFrozen ? "Aktiflestir" : "Dondur"}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div style={{ display: "grid", gap: 16 }}>
                    <div className="card">
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                            <CreditCard size={18} color="#2563eb" />
                            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Kart ayarlari</h2>
                        </div>
                        {cards.length === 0 ? (
                            <EmptyState message="Henuz kartiniz yok." />
                        ) : cards.map((card) => {
                            const cardId = card.id || card.card_id;
                            const isFrozen = card.status !== "active";
                            return (
                                <div key={cardId} style={panelRowStyle}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                            <strong>{card.card_name || (card.is_virtual ? "Sanal Kart" : "Fiziksel Kart")}</strong>
                                            <span style={typeChipStyle(card.is_virtual)}>{card.is_virtual ? "Sanal" : "Fiziksel"}</span>
                                        </div>
                                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{maskCardNumber(card.card_number)}</div>
                                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                                            <ToggleButton label="Internet" icon={<Wifi size={14} />} active={card.internet_enabled} onClick={() => updateCardSetting(card, { internet_enabled: !card.internet_enabled })} disabled={busyKey === `card-${cardId}`} />
                                            <ToggleButton label="Temassiz" icon={<CreditCard size={14} />} active={card.contactless_enabled} onClick={() => updateCardSetting(card, { contactless_enabled: !card.contactless_enabled })} disabled={busyKey === `card-${cardId}`} />
                                            <ToggleButton label="Yurt disi" icon={<Globe2 size={14} />} active={card.overseas_enabled} onClick={() => updateCardSetting(card, { overseas_enabled: !card.overseas_enabled })} disabled={busyKey === `card-${cardId}`} />
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                        <button type="button" onClick={() => toggleCardFreeze(card)} disabled={busyKey === `card-freeze-${cardId}`} style={statusButtonStyle(isFrozen)}>
                                            {isFrozen ? <Unlock size={14} /> : <Lock size={14} />}
                                            {isFrozen ? "Aktiflestir" : "Dondur"}
                                        </button>
                                        {card.is_virtual ? (
                                            <button type="button" onClick={() => deleteVirtualCard(card)} disabled={busyKey === `card-delete-${cardId}`} style={dangerButtonStyle}>
                                                <Trash2 size={14} /> Sil
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="card">
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                            <Smartphone size={18} color="#10b981" />
                            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Guvenlik notu</h2>
                        </div>
                        <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.7, margin: 0 }}>
                            Sanal kartlari sadece internet odemelerinde acik tutun. Supheli durumda karti dondurup sanal karti silmek fiziksel karti korumak icin iyi bir ilk adimdir.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ToggleButton({ label, icon, active, onClick, disabled }) {
    return (
        <button type="button" onClick={onClick} disabled={disabled} style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid var(--border-color)", background: active ? "rgba(16,185,129,0.14)" : "var(--bg-secondary)", color: active ? "#10b981" : "var(--text-secondary)", display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
            {icon} {label}
        </button>
    );
}

function EmptyState({ message }) {
    return <div style={{ padding: 18, borderRadius: 14, background: "var(--bg-secondary)", color: "var(--text-secondary)", textAlign: "center", fontSize: 13 }}>{message}</div>;
}

function maskCardNumber(value) {
    if (!value || value.length < 8) return value || "";
    return `${value.slice(0, 4)} **** **** ${value.slice(-4)}`;
}

function maskIban(value) {
    if (!value || value.length < 8) return value || "";
    return `${value.slice(0, 4)} **** **** **** ${value.slice(-4)}`;
}

function typeChipStyle(isVirtual) {
    return {
        padding: "4px 10px",
        borderRadius: 999,
        background: isVirtual ? "rgba(16,185,129,0.14)" : "rgba(37,99,235,0.14)",
        color: isVirtual ? "#10b981" : "#2563eb",
        fontWeight: 700,
        fontSize: 11,
    };
}

function statusButtonStyle(isFrozen) {
    return {
        padding: "8px 12px",
        borderRadius: 12,
        border: "none",
        background: isFrozen ? "linear-gradient(135deg, #10b981, #34d399)" : "linear-gradient(135deg, #ef4444, #f87171)",
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        cursor: "pointer",
        fontWeight: 700,
    };
}

const panelRowStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    padding: "14px 0",
    borderBottom: "1px solid var(--border-color)",
};

const secondaryButtonStyle = {
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid var(--border-color)",
    background: "var(--bg-secondary)",
    color: "var(--text-primary)",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
    fontWeight: 700,
};

const dangerButtonStyle = {
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid rgba(239,68,68,0.2)",
    background: "rgba(239,68,68,0.08)",
    color: "#ef4444",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
    fontWeight: 700,
};
