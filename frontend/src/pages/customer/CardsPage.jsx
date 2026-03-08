import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import {
    Activity,
    ArrowDownRight,
    ArrowUpRight,
    CalendarDays,
    Copy,
    CreditCard,
    DollarSign,
    Eye,
    EyeOff,
    Layers3,
    Percent,
    PlusCircle,
    RefreshCw,
    ShoppingCart,
    ShieldCheck,
    Smartphone,
} from "lucide-react";
import { accountApi, cardsApi } from "../../services/api";

export default function CardsPage() {
    const [cards, setCards] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [selectedCardId, setSelectedCardId] = useState("");
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("transactions");
    const [selectedAccount, setSelectedAccount] = useState("");
    const [payAmount, setPayAmount] = useState("");
    const [purchaseAmount, setPurchaseAmount] = useState("");
    const [purchaseDescription, setPurchaseDescription] = useState("");
    const [virtualCardForm, setVirtualCardForm] = useState({ alias: "", online_limit: "" });
    const [showSensitive, setShowSensitive] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (selectedCardId) {
            loadTransactions(selectedCardId);
        } else {
            setTransactions([]);
        }
    }, [selectedCardId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [cardsRes, accountsRes] = await Promise.all([
                cardsApi.getMyCards(),
                accountApi.listMine(),
            ]);
            const nextCards = Array.isArray(cardsRes.data) ? cardsRes.data : [];
            const nextAccounts = Array.isArray(accountsRes.data) ? accountsRes.data.filter((account) => account.status === "active") : [];
            setCards(nextCards);
            setAccounts(nextAccounts);

            if (!selectedCardId && nextCards[0]) {
                setSelectedCardId(nextCards[0].id || nextCards[0].card_id);
            } else if (selectedCardId && !nextCards.some((card) => (card.id || card.card_id) === selectedCardId)) {
                setSelectedCardId(nextCards[0] ? (nextCards[0].id || nextCards[0].card_id) : "");
            }

            if (!selectedAccount && nextAccounts[0]) {
                setSelectedAccount(nextAccounts[0].id || nextAccounts[0].account_id);
            }
        } catch (error) {
            toast.error("Kart verileri yuklenemedi.");
            setCards([]);
            setAccounts([]);
            setTransactions([]);
        } finally {
            setLoading(false);
        }
    };

    const loadTransactions = async (cardId) => {
        try {
            const res = await cardsApi.getCardTransactions(cardId);
            setTransactions(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            setTransactions([]);
        }
    };

    const handleApply = async () => {
        if (!window.confirm("Fiziksel kredi karti basvurusu olusturulsun mu?")) return;
        setActionLoading(true);
        try {
            await cardsApi.applyForCard({});
            toast.success("Kredi karti olusturuldu.");
            await loadData();
        } catch (error) {
            toast.error(error.response?.data?.detail || "Kart basvurusu basarisiz.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleCreateVirtualCard = async (event) => {
        event.preventDefault();
        setActionLoading(true);
        try {
            await cardsApi.createVirtualCard({
                alias: virtualCardForm.alias || undefined,
                online_limit: virtualCardForm.online_limit ? Number(virtualCardForm.online_limit) : undefined,
            });
            toast.success("Sanal kart olusturuldu.");
            setVirtualCardForm({ alias: "", online_limit: "" });
            await loadData();
        } catch (error) {
            toast.error(error.response?.data?.detail || "Sanal kart olusturulamadi.");
        } finally {
            setActionLoading(false);
        }
    };

    const handlePayDebt = async (event) => {
        event.preventDefault();
        if (!selectedCard || !selectedAccount || !payAmount) {
            toast.error("Odeme icin kart, hesap ve tutar secin.");
            return;
        }
        setActionLoading(true);
        try {
            await cardsApi.payCardDebt(selectedCard.id || selectedCard.card_id, selectedAccount, Number(payAmount));
            toast.success("Kart borcu odendi.");
            setPayAmount("");
            await loadData();
        } catch (error) {
            toast.error(error.response?.data?.detail || "Kart borcu odenemedi.");
        } finally {
            setActionLoading(false);
        }
    };

    const handlePurchase = async (event) => {
        event.preventDefault();
        if (!selectedCard || !purchaseAmount || !purchaseDescription.trim()) {
            toast.error("Harcama icin tutar ve aciklama girin.");
            return;
        }
        setActionLoading(true);
        try {
            await cardsApi.purchase(selectedCard.id || selectedCard.card_id, Number(purchaseAmount), purchaseDescription.trim());
            toast.success("Kart harcamasi kaydedildi.");
            setPurchaseAmount("");
            setPurchaseDescription("");
            await loadData();
        } catch (error) {
            toast.error(error.response?.data?.detail || "Kart harcamasi basarisiz.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleToggleSetting = async (settingName, currentValue) => {
        if (!selectedCard) return;
        setActionLoading(true);
        try {
            await cardsApi.updateSettings(selectedCard.id || selectedCard.card_id, {
                [settingName]: !currentValue
            });
            toast.success("Kart ayarlari guncellendi.");
            await loadData();
        } catch (error) {
            toast.error(error.response?.data?.detail || "Ayar guncellenemedi.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleToggleFreeze = async () => {
        if (!selectedCard) return;
        setActionLoading(true);
        try {
            await cardsApi.toggleFreeze(selectedCard.id || selectedCard.card_id);
            toast.success(selectedCard.status === "active" ? "Kart gecici olarak donduruldu." : "Kart tekrar aktif edildi.");
            await loadData();
        } catch (error) {
            toast.error(error.response?.data?.detail || "Kart durumu degistirilemedi.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteVirtualCard = async () => {
        if (!selectedCard || !selectedCard.is_virtual) return;
        if (!window.confirm("Bu sanal karti kalici olarak silmek istediginize emin misiniz? Iptal edilemez.")) return;
        setActionLoading(true);
        try {
            await cardsApi.deleteCard(selectedCard.id || selectedCard.card_id);
            toast.success("Sanal kart silindi.");
            setSelectedCardId("");
            await loadData();
        } catch (error) {
            toast.error(error.response?.data?.detail || "Sanal kart silinemedi.");
        } finally {
            setActionLoading(false);
        }
    };

    const selectedCard = cards.find((card) => (card.id || card.card_id) === selectedCardId) || cards[0] || null;
    const hasPhysicalCard = cards.some((card) => !card.is_virtual);
    const paymentAccounts = useMemo(() => accounts.map((account) => ({
        id: account.id || account.account_id,
        account_number: account.account_number,
        balance: Number(account.balance || 0),
    })), [accounts]);

    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
                <div style={{ width: 48, height: 48, border: "4px solid var(--border-color)", borderTop: "4px solid #2563eb", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                <style>{"@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }"}</style>
            </div>
        );
    }

    if (!hasPhysicalCard) {
        return (
            <div style={{ maxWidth: 920, margin: "0 auto", padding: 24 }}>
                <div style={{ background: "var(--bg-card)", borderRadius: 24, padding: 56, textAlign: "center", border: "1px solid var(--border-color)" }}>
                    <div style={{ width: 88, height: 88, borderRadius: "50%", background: "rgba(37,99,235,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
                        <CreditCard size={44} color="#2563eb" />
                    </div>
                    <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 10 }}>Kredi kartinizi acin</h1>
                    <p style={{ color: "var(--text-secondary)", lineHeight: 1.6, maxWidth: 520, margin: "0 auto 28px" }}>
                        Fiziksel kredi kartinizi olusturduktan sonra sanal kart ekleyebilir, internet limiti belirleyebilir ve kart hareketlerini tek panelden takip edebilirsiniz.
                    </p>
                    <button onClick={handleApply} disabled={actionLoading} style={primaryActionStyle}>
                        {actionLoading ? <RefreshCw size={18} style={{ animation: "spin 1s linear infinite" }} /> : <PlusCircle size={18} />}
                        Fiziksel kart olustur
                    </button>
                </div>
                <style>{"@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }"}</style>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
                <div>
                    <h1 style={{ fontSize: 30, fontWeight: 800, margin: 0 }}>Kartlarim</h1>
                    <p style={{ color: "var(--text-secondary)", margin: "8px 0 0" }}>
                        Fiziksel kartinizi ve sanal kartlarinizi secip limiti, borcu ve hareketleri yonetin.
                    </p>
                </div>
                <button type="button" onClick={() => setShowSensitive((prev) => !prev)} style={secondaryActionStyle}>
                    {showSensitive ? <EyeOff size={16} /> : <Eye size={16} />}
                    {showSensitive ? "Kart bilgilerini gizle" : "Kart bilgilerini goster"}
                </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
                <div style={{ display: "grid", gap: 16 }}>
                    <div className="card">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                            <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Kart secimi</h3>
                            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{cards.length} kart</span>
                        </div>
                        <div style={{ display: "grid", gap: 10 }}>
                            {cards.map((card) => {
                                const cardKey = card.id || card.card_id;
                                const active = cardKey === (selectedCard?.id || selectedCard?.card_id);
                                return (
                                    <button key={cardKey} type="button" onClick={() => setSelectedCardId(cardKey)} style={cardSelectorStyle(active)}>
                                        <div>
                                            <div style={{ fontWeight: 700 }}>{card.card_name || (card.is_virtual ? "Sanal Kart" : "Fiziksel Kart")}</div>
                                            <div style={{ fontSize: 12, color: active ? "rgba(255,255,255,0.82)" : "var(--text-secondary)", marginTop: 4 }}>
                                                {maskCardNumber(card.card_number)}
                                            </div>
                                        </div>
                                        <span style={selectorBadgeStyle(active, card.is_virtual)}>{card.is_virtual ? "Sanal" : "Fiziksel"}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="card">
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                            <Smartphone size={18} color="#2563eb" />
                            <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Sanal kart olustur</h3>
                        </div>
                        <form onSubmit={handleCreateVirtualCard} style={{ display: "grid", gap: 14 }}>
                            <div>
                                <label style={labelStyle}>Kart etiketi</label>
                                <input className="form-input" value={virtualCardForm.alias} onChange={(event) => setVirtualCardForm((prev) => ({ ...prev, alias: event.target.value }))} placeholder="Ornek: Steam, Netflix, reklam" />
                            </div>
                            <div>
                                <label style={labelStyle}>Online limit</label>
                                <input className="form-input" type="number" min="1" step="0.01" value={virtualCardForm.online_limit} onChange={(event) => setVirtualCardForm((prev) => ({ ...prev, online_limit: event.target.value }))} placeholder="Ornek: 2500" />
                            </div>
                            <button type="submit" disabled={actionLoading} style={{ ...primaryActionStyle, width: "100%" }}>
                                {actionLoading ? <RefreshCw size={18} style={{ animation: "spin 1s linear infinite" }} /> : <Layers3 size={18} />}
                                Sanal kart ekle
                            </button>
                        </form>
                    </div>
                </div>

                {selectedCard ? (
                    <>
                        <div style={{ display: "grid", gap: 16 }}>
                            <div style={cardVisualStyle}>
                                <div style={{ position: "absolute", top: -26, right: -16, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.14)" }} />
                                <div style={{ position: "absolute", bottom: -36, left: -16, width: 120, height: 120, borderRadius: "50%", background: selectedCard.is_virtual ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.16)", transition: "all 0.3s" }} />
                                <div style={{ position: "relative", zIndex: 1, transition: "all 0.3s" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 36 }}>
                                        <div>
                                            <div style={{ fontWeight: 800, fontSize: 22 }}>FinBank</div>
                                            <div style={{ fontSize: 12, opacity: 0.74, marginTop: 4 }}>{selectedCard.card_name || "Kart"}</div>
                                        </div>
                                        <span style={typeChipStyle(selectedCard.is_virtual)}>{selectedCard.is_virtual ? "Sanal Kart" : "Fiziksel Kart"}</span>
                                    </div>
                                    <div style={{ marginBottom: 24 }}>
                                        <div style={{ fontSize: 11, opacity: 0.7, textTransform: "uppercase", letterSpacing: 1.5 }}>Kart numarasi</div>
                                        <div style={{ fontFamily: "monospace", fontSize: 24, fontWeight: 700, letterSpacing: 3, marginTop: 10 }}>
                                            {showSensitive ? formatCardNumber(selectedCard.card_number) : maskCardNumber(selectedCard.card_number)}
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 22 }}>
                                        <div>
                                            <div style={{ fontSize: 11, opacity: 0.7, textTransform: "uppercase", letterSpacing: 1.5 }}>Kart sahibi</div>
                                            <div style={{ fontWeight: 700, marginTop: 6 }}>{selectedCard.cardholder_name || "Musteri"}</div>
                                        </div>
                                        <div style={{ display: "flex", gap: 32, textAlign: "right" }}>
                                            <div>
                                                <div style={{ fontSize: 11, opacity: 0.7, textTransform: "uppercase", letterSpacing: 1.5 }}>Son kullanma</div>
                                                <div style={{ fontFamily: "monospace", fontWeight: 700, marginTop: 6 }}>{selectedCard.expiry_date}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 11, opacity: 0.7, textTransform: "uppercase", letterSpacing: 1.5 }}>CVV</div>
                                                <div style={{ fontFamily: "monospace", fontWeight: 700, marginTop: 6 }}>{showSensitive ? selectedCard.cvv : "***"}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                                        <button type="button" onClick={() => { navigator.clipboard.writeText(selectedCard.card_number); toast.success("Kart numarasi kopyalandi."); }} style={miniButtonStyle}>
                                            <Copy size={14} /> Kart no kopyala
                                        </button>
                                        <button type="button" onClick={handleToggleFreeze} disabled={actionLoading} style={{ ...statusButtonStyle(selectedCard.status), cursor: actionLoading ? "not-allowed" : "pointer", opacity: actionLoading ? 0.7 : 1 }}>
                                            {selectedCard.status === "active" ? "Aktif" : "Donduruldu"}
                                        </button>
                                        {selectedCard.is_virtual && (
                                            <button type="button" onClick={handleDeleteVirtualCard} disabled={actionLoading} style={{ ...miniButtonStyle, border: "1px solid rgba(239, 68, 68, 0.4)", color: "#fca5a5" }}>
                                                Sil
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                <MetricCard label="Kullanilabilir limit" value={formatMoney(selectedCard.available_limit)} tone="#10b981" icon={<ShieldCheck size={18} />} />
                                <MetricCard label="Guncel borc" value={formatMoney(selectedCard.current_debt)} tone="#ef4444" icon={<DollarSign size={18} />} />
                                <MetricCard label="Asgari odeme" value={formatMoney(selectedCard.min_payment_due)} tone="#f59e0b" icon={<CalendarDays size={18} />} />
                                <MetricCard label="Online limit" value={formatMoney(selectedCard.online_limit)} tone="#2563eb" icon={<Percent size={18} />} />
                            </div>

                            <div className="card">
                                <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Kart ayarlari</h3>
                                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                                    <InteractiveChip
                                        active={selectedCard.internet_shopping}
                                        onClick={() => handleToggleSetting("internet_shopping", selectedCard.internet_shopping)}
                                        disabled={actionLoading}
                                    >
                                        Internet alisverisi
                                    </InteractiveChip>
                                    <InteractiveChip
                                        active={selectedCard.contactless}
                                        onClick={() => handleToggleSetting("contactless", selectedCard.contactless)}
                                        disabled={actionLoading || selectedCard.is_virtual}
                                    >
                                        Temassiz
                                    </InteractiveChip>
                                </div>
                            </div>
                        </div>

                        <div>
                            <div style={{ display: "flex", gap: 6, background: "var(--bg-secondary)", borderRadius: 14, padding: 4, marginBottom: 16 }}>
                                <TabButton active={activeTab === "transactions"} onClick={() => setActiveTab("transactions")}><Activity size={14} /> Hareketler</TabButton>
                                <TabButton active={activeTab === "pay"} onClick={() => setActiveTab("pay")}><DollarSign size={14} /> Borc ode</TabButton>
                                <TabButton active={activeTab === "simulate"} onClick={() => setActiveTab("simulate")}><ShoppingCart size={14} /> Harcama</TabButton>
                            </div>

                            <div style={{ background: "var(--bg-card)", borderRadius: 20, border: "1px solid var(--border-color)", minHeight: 420, overflow: "hidden" }}>
                                {activeTab === "transactions" ? (
                                    <div>
                                        <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div>
                                                <div style={{ fontSize: 16, fontWeight: 800 }}>Kart hareketleri</div>
                                                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{selectedCard.card_name || "Kart"} icin son islemler</div>
                                            </div>
                                            <button type="button" onClick={() => loadTransactions(selectedCard.id || selectedCard.card_id)} style={secondaryActionStyle}>
                                                <RefreshCw size={16} /> Yenile
                                            </button>
                                        </div>
                                        {transactions.length === 0 ? (
                                            <div style={{ padding: 56, textAlign: "center", color: "var(--text-secondary)" }}>Bu kart icin henuz hareket yok.</div>
                                        ) : transactions.map((transaction) => {
                                            const isPayment = transaction.type === "payment";
                                            return (
                                                <div key={transaction.id || transaction.transaction_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid var(--border-color)" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                        <div style={{ width: 40, height: 40, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: isPayment ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)", color: isPayment ? "#10b981" : "#ef4444" }}>
                                                            {isPayment ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 700 }}>{transaction.description || (isPayment ? "Kart odemesi" : "Kart harcamasi")}</div>
                                                            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{new Date(transaction.created_at).toLocaleString("tr-TR")}</div>
                                                        </div>
                                                    </div>
                                                    <div style={{ fontWeight: 800, color: isPayment ? "#10b981" : "#ef4444" }}>
                                                        {isPayment ? "+" : "-"}{formatMoney(transaction.amount)}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : null}

                                {activeTab === "pay" ? (
                                    <div style={{ padding: 24 }}>
                                        <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Kart borcu odeme</h3>
                                        <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 18 }}>Secili kartin borcunu aktif hesaplarinizdan biriyle odeyin.</p>
                                        <form onSubmit={handlePayDebt} style={{ display: "grid", gap: 16, maxWidth: 420 }}>
                                            <div>
                                                <label style={labelStyle}>Odeme hesabi</label>
                                                <select className="form-select" value={selectedAccount} onChange={(event) => setSelectedAccount(event.target.value)} required>
                                                    <option value="">Hesap secin</option>
                                                    {paymentAccounts.map((account) => (
                                                        <option key={account.id} value={account.id}>{account.account_number} - {formatMoney(account.balance)}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Odeme tutari</label>
                                                <input className="form-input" type="number" min="1" max={selectedCard.current_debt} step="0.01" value={payAmount} onChange={(event) => setPayAmount(event.target.value)} required />
                                            </div>
                                            <button type="submit" disabled={actionLoading || Number(selectedCard.current_debt) <= 0} style={primaryActionStyle}>
                                                {actionLoading ? <RefreshCw size={18} style={{ animation: "spin 1s linear infinite" }} /> : <DollarSign size={18} />}
                                                Borcu ode
                                            </button>
                                        </form>
                                    </div>
                                ) : null}

                                {activeTab === "simulate" ? (
                                    <div style={{ padding: 24 }}>
                                        <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Kart harcamasi</h3>
                                        <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 18 }}>Internet acik olan kartlar icin test harcamasi olusturabilirsiniz.</p>
                                        <form onSubmit={handlePurchase} style={{ display: "grid", gap: 16, maxWidth: 420 }}>
                                            <div>
                                                <label style={labelStyle}>Harcama tutari</label>
                                                <input className="form-input" type="number" min="1" max={selectedCard.available_limit} step="0.01" value={purchaseAmount} onChange={(event) => setPurchaseAmount(event.target.value)} required />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Aciklama</label>
                                                <input className="form-input" value={purchaseDescription} onChange={(event) => setPurchaseDescription(event.target.value)} placeholder="Ornek: reklam, oyun, market" required />
                                            </div>
                                            <button type="submit" disabled={actionLoading || Number(selectedCard.available_limit) <= 0} style={{ ...primaryActionStyle, background: "linear-gradient(135deg, #2563eb, #60a5fa)" }}>
                                                {actionLoading ? <RefreshCw size={18} style={{ animation: "spin 1s linear infinite" }} /> : <ShoppingCart size={18} />}
                                                Harcama yap
                                            </button>
                                        </form>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </>
                ) : null}
            </div>
            <style>{"@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }"}</style>
        </div>
    );
}

function MetricCard({ icon, label, value, tone }) {
    return (
        <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 18, border: "1px solid var(--border-color)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: tone, marginBottom: 8 }}>
                {icon}
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</span>
            </div>
            <div style={{ fontWeight: 800, fontSize: 20, color: tone }}>{value}</div>
        </div>
    );
}

function Chip({ active, children }) {
    return (
        <span style={{ padding: "8px 12px", borderRadius: 999, background: active ? "rgba(16,185,129,0.14)" : "rgba(148,163,184,0.14)", color: active ? "#10b981" : "var(--text-secondary)", fontWeight: 700, fontSize: 12, transition: "all 0.2s" }}>
            {children}
        </span>
    );
}

function InteractiveChip({ active, onClick, disabled, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            style={{
                padding: "8px 16px",
                borderRadius: 999,
                border: "none",
                background: active ? "rgba(16,185,129,0.14)" : "rgba(148,163,184,0.14)",
                color: active ? "#10b981" : "var(--text-secondary)",
                fontWeight: 700,
                fontSize: 13,
                cursor: disabled ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                opacity: disabled ? 0.6 : 1
            }}
        >
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: active ? "#10b981" : "currentColor" }} />
            {children}
        </button>
    );
}

function TabButton({ active, onClick, children }) {
    return (
        <button type="button" onClick={onClick} style={{ flex: 1, border: "none", borderRadius: 12, padding: "11px 14px", background: active ? "var(--bg-card)" : "transparent", color: active ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {children}
        </button>
    );
}

function formatMoney(value) {
    return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(Number(value || 0));
}

function formatCardNumber(value) {
    if (!value) return "";
    return value.replace(/(\d{4})/g, "$1 ").trim();
}

function maskCardNumber(value) {
    if (!value || value.length < 8) return value || "";
    return `${value.slice(0, 4)} **** **** ${value.slice(-4)}`;
}

function statusButtonStyle(status) {
    return {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 16px",
        borderRadius: 999,
        border: "none",
        background: status === "active" ? "rgba(16,185,129,0.16)" : "rgba(239,68,68,0.16)",
        color: status === "active" ? "#10b981" : "#ef4444",
        fontWeight: 700,
        fontSize: 12,
        transition: "all 0.2s"
    };
}

function typeChipStyle(isVirtual) {
    return {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 12px",
        borderRadius: 999,
        background: isVirtual ? "rgba(34,197,94,0.16)" : "rgba(255,255,255,0.14)",
        color: "#fff",
        fontWeight: 700,
        fontSize: 12,
    };
}

function selectorBadgeStyle(active, isVirtual) {
    return {
        padding: "6px 10px",
        borderRadius: 999,
        background: active ? "rgba(255,255,255,0.16)" : isVirtual ? "rgba(34,197,94,0.12)" : "rgba(37,99,235,0.12)",
        color: active ? "#fff" : isVirtual ? "#10b981" : "#2563eb",
        fontWeight: 700,
        fontSize: 11,
    };
}

function cardSelectorStyle(active) {
    return {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        width: "100%",
        padding: 14,
        borderRadius: 16,
        border: active ? "none" : "1px solid var(--border-color)",
        background: active ? "linear-gradient(135deg, #111827, #2563eb)" : "var(--bg-secondary)",
        color: active ? "#fff" : "var(--text-primary)",
        cursor: "pointer",
        textAlign: "left",
    };
}

const labelStyle = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-secondary)",
    marginBottom: 6,
};

const primaryActionStyle = {
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    color: "#fff",
    border: "none",
    padding: "14px 24px",
    borderRadius: 14,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
};

const secondaryActionStyle = {
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

const miniButtonStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.08)",
    color: "#f8fafc",
    cursor: "pointer",
    fontWeight: 600,
};

const cardVisualStyle = {
    borderRadius: 24,
    padding: 28,
    color: "#f8fafc",
    position: "relative",
    overflow: "hidden",
    background: "linear-gradient(135deg, #111827 0%, #2563eb 55%, #0f172a 100%)",
    boxShadow: "0 26px 60px rgba(15, 23, 42, 0.3)",
};


