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
    Landmark,
    Send,
} from "lucide-react";
import { accountApi, cardsApi, approvalsApi } from "../../services/api";

export default function CardsPage() {
    const [cards, setCards] = useState([]);
    const [debitCards, setDebitCards] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [selectedCardId, setSelectedCardId] = useState("");
    const [cardTypeTab, setCardTypeTab] = useState("credit"); // "credit" or "debit"
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("transactions");
    const [selectedAccount, setSelectedAccount] = useState("");
    const [payAmount, setPayAmount] = useState("");
    const [purchaseAmount, setPurchaseAmount] = useState("");
    const [purchaseDescription, setPurchaseDescription] = useState("");
    const [virtualCardForm, setVirtualCardForm] = useState({ alias: "", online_limit: "" });
    const [showSensitive, setShowSensitive] = useState(false);
    const [isFlipped, setIsFlipped] = useState(false);

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
            const [cardsRes, accountsRes, debitRes] = await Promise.all([
                cardsApi.getMyCards(),
                accountApi.listMine(),
                accountApi.getDebitCards().catch(() => ({ data: [] })),
            ]);
            const nextCards = Array.isArray(cardsRes.data) ? cardsRes.data : [];
            const nextDebitCards = Array.isArray(debitRes.data) ? debitRes.data : [];
            const nextAccounts = Array.isArray(accountsRes.data) ? accountsRes.data.filter((account) => account.status === "active") : [];
            setCards(nextCards);
            setDebitCards(nextDebitCards);
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

    const handleApplyLimit = async () => {
        if (!selectedCardId) return;
        const requestedLimitStr = window.prompt("Yeni talep ettiğiniz kredi limitini giriniz:");
        if (!requestedLimitStr) return;
        const requestedLimit = parseFloat(requestedLimitStr);
        if (isNaN(requestedLimit) || requestedLimit <= 0) {
            toast.error("Geçerli bir tutar giriniz.");
            return;
        }

        setActionLoading(true);
        try {
            await approvalsApi.createApproval({
                request_type: "CREDIT_LIMIT_INCREASE",
                amount: requestedLimit,
                currency: "TRY",
                description: "Kredi Kartı Limit Artış Talebi",
                metadata: {
                    card_id: selectedCardId
                }
            });
            toast.success("Limit artış talebiniz alındı ve onaya gönderildi.");
        } catch (error) {
            toast.error(error.response?.data?.detail || "Talep gönderilemedi.");
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

    const displayCards = cardTypeTab === "credit" ? cards : debitCards;
    const selectedCard = displayCards.find((card) => (card.id || card.card_id) === selectedCardId) || displayCards[0] || null;
    const hasPhysicalCard = cards.some((card) => !card.is_virtual);
    const paymentAccounts = useMemo(() => accounts.map((account) => ({
        id: account.id || account.account_id,
        account_number: account.account_number,
        balance: Number(account.balance || 0),
    })), [accounts]);

    const linkedAccount = paymentAccounts.find(a => a.account_number === selectedCard?.account_number) || {};
    const linkedBalance = linkedAccount.balance || 0;

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
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
                <TabButton active={cardTypeTab === "credit"} onClick={() => { setCardTypeTab("credit"); setSelectedCardId(""); }}>
                    <CreditCard size={16} /> Kredi Kartları
                </TabButton>
                <TabButton active={cardTypeTab === "debit"} onClick={() => { setCardTypeTab("debit"); setSelectedCardId(""); }}>
                    <Landmark size={16} /> Banka Kartları
                </TabButton>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
                <div style={{ display: "grid", gap: 16 }}>
                    <div className="card">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                            <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Kart secimi</h3>
                            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{displayCards.length} kart</span>
                        </div>
                        <div style={{ display: "grid", gap: 10 }}>
                            {displayCards.length === 0 && <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Bu kategoride kartınız bulunmuyor.</p>}
                            {displayCards.map((card) => {
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

                    {cardTypeTab === "credit" && (
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
                    )}
                </div>

                {selectedCard ? (
                    <>
                        <div style={{ display: "grid", gap: 16 }}>
                            {/* 3D Flip Card Container */}
                            <div className={`flip-card ${isFlipped ? "flipped" : ""}`}>
                                <div className="flip-card-inner">
                                    {/* Front Face */}
                                    <div className="flip-card-front" style={{ ...cardVisualStyle, background: cardTypeTab === "debit" ? "linear-gradient(135deg, #1e293b 0%, #ef4444 55%, #0f172a 100%)" : selectedCard.is_virtual ? "linear-gradient(135deg, #064e3b 0%, #10b981 100%)" : "linear-gradient(135deg, #111827 0%, #2563eb 55%, #0f172a 100%)" }}>
                                        <div style={{ position: "absolute", top: -26, right: -16, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.14)" }} />
                                        <div style={{ position: "absolute", bottom: -36, left: -16, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />

                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 36, position: "relative", zIndex: 1 }}>
                                            <div>
                                                <div style={{ fontWeight: 800, fontSize: 24, letterSpacing: -0.5 }}>FinBank</div>
                                                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{selectedCard.card_name || (cardTypeTab === "debit" ? "Banka Kartı" : "Kart")}</div>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                <span style={typeChipStyle(selectedCard.is_virtual)}>{cardTypeTab === "debit" ? "Banka Kartı" : selectedCard.is_virtual ? "Sanal Kart" : "Fiziksel Kart"}</span>
                                            </div>
                                        </div>

                                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                                            <div style={{ width: 44, height: 32, background: "linear-gradient(135deg, #ffd700, #ffb300)", borderRadius: 6, opacity: 0.9, position: "relative", overflow: "hidden" }}>
                                                <div style={{ position: "absolute", top: "50%", left: 0, width: "100%", height: 1, background: "rgba(0,0,0,0.2)" }} />
                                                <div style={{ position: "absolute", left: "50%", top: 0, width: 1, height: "100%", background: "rgba(0,0,0,0.2)" }} />
                                            </div>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" /><path d="M16 8h.01" /><path d="M16 16h.01" /><path d="M8 8h.01" /><path d="M8 16h.01" /><path d="M12 12h.01" /></svg>
                                        </div>

                                        <div style={{ marginBottom: 28 }}>
                                            <div style={{ fontSize: 11, opacity: 0.7, textTransform: "uppercase", letterSpacing: 1.5 }}>Kart numarasi</div>
                                            <div style={{ fontFamily: "monospace", fontSize: 24, fontWeight: 700, letterSpacing: 3, marginTop: 8 }}>
                                                {showSensitive ? formatCardNumber(selectedCard.card_number) : maskCardNumber(selectedCard.card_number)}
                                            </div>
                                        </div>

                                        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-end", position: "relative", zIndex: 1 }}>
                                            <div>
                                                <div style={{ fontSize: 11, opacity: 0.7, textTransform: "uppercase", letterSpacing: 1.5 }}>Kart sahibi</div>
                                                <div style={{ fontWeight: 700, marginTop: 6, fontSize: 15 }}>{selectedCard.cardholder_name || selectedCard.holder_name || "Musteri"}</div>
                                            </div>
                                            <div style={{ textAlign: "right", paddingRight: 8 }}>
                                                <button type="button" onClick={() => setIsFlipped(true)} style={{ ...miniButtonStyle, padding: "8px 16px" }}>
                                                    Arkasına Çevir
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Back Face */}
                                    <div className="flip-card-back">
                                        <div className="magnetic-stripe" />
                                        <div className="signature-strip">
                                            <span style={{ fontFamily: "monospace", fontWeight: 800, color: "#1e293b", fontSize: 16, fontStyle: "italic" }}>
                                                {showSensitive ? selectedCard.cvv : "***"}
                                            </span>
                                        </div>

                                        <div style={{ padding: "16px 24px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                                            <div>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                                    <div style={{ fontSize: 12, opacity: 0.7 }}>Son kullanma: <strong style={{ fontFamily: "monospace", fontSize: 14 }}>{showSensitive ? selectedCard.expiry_date : "**/**"}</strong></div>
                                                    <button type="button" onClick={() => setShowSensitive((prev) => !prev)} style={{ ...miniButtonStyle, padding: "6px 12px", background: showSensitive ? "rgba(99, 102, 241, 0.2)" : "rgba(255,255,255,0.08)" }}>
                                                        {showSensitive ? <EyeOff size={14} /> : <Eye size={14} />} {showSensitive ? "Gizle" : "Göster"}
                                                    </button>
                                                </div>

                                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                                    <button type="button" onClick={() => { navigator.clipboard.writeText(selectedCard.card_number); toast.success("Kart numarasi kopyalandi."); }} style={miniButtonStyle}>
                                                        <Copy size={14} /> Kart no kopyala
                                                    </button>
                                                    <button type="button" onClick={handleToggleFreeze} disabled={actionLoading} style={{ ...statusButtonStyle(selectedCard.status), cursor: actionLoading ? "not-allowed" : "pointer", opacity: actionLoading ? 0.7 : 1 }}>
                                                        {selectedCard.status === "active" ? "Aktif (Dondur)" : "Donduruldu (Aç)"}
                                                    </button>
                                                    {selectedCard.is_virtual && (
                                                        <button type="button" onClick={handleDeleteVirtualCard} disabled={actionLoading} style={{ ...miniButtonStyle, border: "1px solid rgba(239, 68, 68, 0.4)", color: "#fca5a5" }}>
                                                            Sil
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            <div style={{ textAlign: "right" }}>
                                                <button type="button" onClick={() => setIsFlipped(false)} style={{ ...miniButtonStyle, padding: "8px 16px" }}>
                                                    Ön Yüze Çevir
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {cardTypeTab === "credit" ? (
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                    <MetricCard label="Kullanilabilir limit" value={formatMoney(selectedCard.available_limit)} tone="#10b981" icon={<ShieldCheck size={18} />} />
                                    <MetricCard label="Guncel borc" value={formatMoney(selectedCard.current_debt)} tone="#ef4444" icon={<DollarSign size={18} />} />
                                    <MetricCard label="Asgari odeme" value={formatMoney(selectedCard.min_payment_due)} tone="#f59e0b" icon={<CalendarDays size={18} />} />
                                    <MetricCard label="Online limit" value={formatMoney(selectedCard.online_limit)} tone="#2563eb" icon={<Percent size={18} />} />
                                </div>
                            ) : (
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                    <MetricCard label="Bağlı Hesap Bakiyesi" value={formatMoney(linkedBalance)} tone="#10b981" icon={<ShieldCheck size={18} />} />
                                    <MetricCard label="Hesap Türü" value={selectedCard.account_type === "checking" ? "Vadesiz" : "Tasarruf"} tone="#2563eb" icon={<Landmark size={18} />} />
                                </div>
                            )}

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

                            {cardTypeTab === "credit" && !selectedCard.is_virtual && (
                                <div className="card" style={{ marginTop: 16 }}>
                                    <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Limit İşlemleri</h3>
                                    <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>
                                        Daha yüksek bir limite ihtiyacınız varsa limit artış talebinde bulunabilirsiniz. Talebiniz incelemeye alınacaktır.
                                    </p>
                                    <button
                                        onClick={handleApplyLimit}
                                        disabled={actionLoading}
                                        style={{ ...primaryActionStyle, background: "var(--accent)" }}
                                    >
                                        <ArrowUpRight size={18} /> Limit Artırım Talebi
                                    </button>
                                </div>
                            )}
                        </div>

                        {cardTypeTab === "credit" && (
                            <div>
                                <div style={{ display: "flex", gap: 6, background: "var(--bg-secondary)", borderRadius: 14, padding: 4, marginBottom: 16 }}>
                                    <TabButton active={activeTab === "transactions"} onClick={() => setActiveTab("transactions")}><Activity size={14} /> Hareketler</TabButton>
                                    <TabButton active={activeTab === "pay"} onClick={() => setActiveTab("pay")}><DollarSign size={14} /> Borc ode</TabButton>
                                    <TabButton active={activeTab === "simulate"} onClick={() => setActiveTab("simulate")}><ShoppingCart size={14} /> Harcama</TabButton>
                                    <TabButton active={false} onClick={() => window.location.href = "/customer/transfer"}><Send size={14} /> Para Transferi</TabButton>
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
                        )}
                    </>
                ) : null}
            </div>
            <style>{"@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }"}</style>
        </div >
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
    color: "#f8fafc",
    padding: 28,
};


