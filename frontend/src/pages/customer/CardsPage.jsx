import { useState, useEffect } from "react";
import { CreditCard, DollarSign, PlusCircle, ArrowUpRight, ArrowDownRight, RefreshCw, ShoppingCart, Activity } from "lucide-react";
import { cardsApi, accountApi } from "../../services/api";
import { toast } from "react-hot-toast";

export default function CardsPage() {
    const [cards, setCards] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [payAmount, setPayAmount] = useState("");
    const [selectedAccount, setSelectedAccount] = useState("");
    const [purchaseAmount, setPurchaseAmount] = useState("");
    const [purchaseDesc, setPurchaseDesc] = useState("");
    const [activeTab, setActiveTab] = useState("transactions");

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [cardsRes, accsRes] = await Promise.all([
                cardsApi.getMyCards(),
                accountApi.listMine()
            ]);
            setCards(cardsRes.data);
            setAccounts(Array.isArray(accsRes.data) ? accsRes.data.filter(a => a.status === "active") : []);
            if (cardsRes.data.length > 0) loadTransactions(cardsRes.data[0].id);
        } catch (error) {
            console.error("Kredi kartları yüklenirken hata:", error);
            toast.error("Veriler yüklenemedi.");
        } finally {
            setLoading(false);
        }
    };

    const loadTransactions = async (cardId) => {
        try {
            const res = await cardsApi.getCardTransactions(cardId);
            setTransactions(res.data);
        } catch (error) { console.error(error); }
    };

    const handleApply = async () => {
        if (!window.confirm("Kredi kartı başvurusu yapmak istiyor musunuz?")) return;
        setActionLoading(true);
        try {
            await cardsApi.applyForCard({});
            toast.success("Kredi kartı başvurunuz onaylandı!");
            loadData();
        } catch (error) {
            toast.error(error.response?.data?.detail || "Başvuru başarısız.");
        } finally { setActionLoading(false); }
    };

    const handlePayDebt = async (e, cardId) => {
        e.preventDefault();
        if (!selectedAccount || !payAmount) { toast.error("Lütfen hesap ve tutar seçin."); return; }
        setActionLoading(true);
        try {
            await cardsApi.payCardDebt(cardId, selectedAccount, parseFloat(payAmount));
            toast.success("Borç başarıyla ödendi!");
            setPayAmount("");
            loadData();
        } catch (error) {
            toast.error(error.response?.data?.detail || "Ödeme başarısız.");
        } finally { setActionLoading(false); }
    };

    const handlePurchase = async (e, cardId) => {
        e.preventDefault();
        if (!purchaseAmount || !purchaseDesc) { toast.error("Lütfen tutar ve açıklama girin."); return; }
        setActionLoading(true);
        try {
            await cardsApi.purchase(cardId, parseFloat(purchaseAmount), purchaseDesc);
            toast.success("Harcama simülasyonu başarılı!");
            setPurchaseAmount("");
            setPurchaseDesc("");
            loadData();
        } catch (error) {
            toast.error(error.response?.data?.detail || "Harcama başarısız.");
        } finally { setActionLoading(false); }
    };

    const fmt = (n) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);
    const fmtCard = (num) => num ? num.replace(/(\d{4})/g, "$1 ").trim() : "";

    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
                <div style={{ width: 48, height: 48, border: "4px solid var(--border-color)", borderTop: "4px solid #ef4444", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            </div>
        );
    }

    const hasCard = cards.length > 0;
    const card = hasCard ? cards[0] : null;

    const tabStyle = (isActive) => ({
        flex: 1, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
        border: "none", borderRadius: 10, transition: "all 0.2s",
        background: isActive ? "var(--bg-card)" : "transparent",
        color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
        boxShadow: isActive ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    });

    const inputStyle = {
        width: "100%", padding: "12px 16px", borderRadius: 12,
        border: "1px solid var(--border-color)", background: "var(--bg-secondary)",
        color: "var(--text-primary)", fontSize: 14, outline: "none", boxSizing: "border-box",
    };

    return (
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
                <CreditCard size={28} color="#ef4444" />
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Kredi Kartlarım</h1>
                    <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>Kredi kartı bilgilerinizi ve harcamalarınızı yönetin.</p>
                </div>
            </div>

            {!hasCard ? (
                <div style={{
                    background: "var(--bg-card)", borderRadius: 20, padding: 48, textAlign: "center",
                    border: "1px solid var(--border-color)",
                }}>
                    <div style={{
                        width: 80, height: 80, borderRadius: "50%", background: "rgba(239,68,68,0.1)",
                        display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px",
                    }}>
                        <CreditCard size={40} color="#ef4444" />
                    </div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Henüz Bir Kredi Kartınız Yok</h2>
                    <p style={{ color: "var(--text-secondary)", maxWidth: 400, margin: "0 auto 32px", lineHeight: 1.6 }}>
                        FinBank ayrıcalıklarından yararlanmak için hemen bir kredi kartı başvurusunda bulunun. Anında onaylanan limitinizle harcamaya başlayın.
                    </p>
                    <button onClick={handleApply} disabled={actionLoading} style={{
                        background: "linear-gradient(135deg, #ef4444, #dc2626)", color: "white",
                        border: "none", padding: "14px 32px", borderRadius: 14, fontSize: 15, fontWeight: 600,
                        cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8,
                        opacity: actionLoading ? 0.7 : 1,
                    }}>
                        {actionLoading ? <RefreshCw size={18} style={{ animation: "spin 1s linear infinite" }} /> : <PlusCircle size={18} />}
                        Hemen Başvur
                    </button>
                </div>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 24 }}>
                    {/* Left Column: Card Visual + Stats */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {/* Credit Card Graphic */}
                        <div style={{
                            borderRadius: 20, padding: 28, color: "white", position: "relative", overflow: "hidden",
                            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
                            boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
                        }}>
                            <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(239,68,68,0.3)", filter: "blur(40px)" }} />
                            <div style={{ position: "absolute", bottom: -20, left: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(99,102,241,0.25)", filter: "blur(30px)" }} />
                            <div style={{ position: "relative", zIndex: 1 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
                                    <span style={{ fontWeight: 700, fontSize: 20, letterSpacing: 2 }}>FinBank</span>
                                    <CreditCard size={28} style={{ opacity: 0.8 }} />
                                </div>
                                <div style={{ marginBottom: 24 }}>
                                    <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 3, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>Kart Numarası</div>
                                    <div style={{ fontSize: 22, fontFamily: "monospace", letterSpacing: 4 }}>{fmtCard(card.card_number)}</div>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <div>
                                        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 3, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>Geçerlilik</div>
                                        <div style={{ fontFamily: "monospace", fontSize: 16 }}>{card.expiry_date}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 3, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>CVV</div>
                                        <div style={{ fontFamily: "monospace", fontSize: 16 }}>***</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Stats Cards */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 18, border: "1px solid var(--border-color)" }}>
                                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Kullanılabilir Limit</div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: "#10b981" }}>{fmt(card.available_limit)}</div>
                                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 6 }}>Toplam: {fmt(card.limit)}</div>
                            </div>
                            <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 18, border: "1px solid var(--border-color)" }}>
                                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Güncel Borç</div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: "#ef4444" }}>{fmt(card.current_debt)}</div>
                                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 6 }}>Faiz: %{card.interest_rate}</div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Tabs */}
                    <div>
                        <div style={{ display: "flex", gap: 4, background: "var(--bg-secondary)", borderRadius: 12, padding: 4, marginBottom: 16 }}>
                            <button onClick={() => setActiveTab("transactions")} style={tabStyle(activeTab === "transactions")}><Activity size={14} /> Hareketler</button>
                            <button onClick={() => setActiveTab("pay")} style={tabStyle(activeTab === "pay")}><DollarSign size={14} /> Borç Öde</button>
                            <button onClick={() => setActiveTab("simulate")} style={tabStyle(activeTab === "simulate")}><ShoppingCart size={14} /> Harcama Yap</button>
                        </div>

                        <div style={{ background: "var(--bg-card)", borderRadius: 20, border: "1px solid var(--border-color)", minHeight: 400, overflow: "hidden" }}>
                            {/* TRANSACTIONS TAB */}
                            {activeTab === "transactions" && (
                                <div>
                                    <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Son Hareketler</h3>
                                        <button onClick={() => loadTransactions(card.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 6, borderRadius: "50%" }}>
                                            <RefreshCw size={16} />
                                        </button>
                                    </div>
                                    {transactions.length === 0 ? (
                                        <div style={{ padding: 48, textAlign: "center", color: "var(--text-secondary)" }}>Henüz kart hareketi bulunmuyor.</div>
                                    ) : (
                                        transactions.map((tx) => (
                                            <div key={tx.transaction_id} style={{
                                                padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center",
                                                borderBottom: "1px solid var(--border-color)", transition: "background 0.15s",
                                            }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                    <div style={{
                                                        width: 38, height: 38, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                                                        background: tx.type === "payment" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                                                        color: tx.type === "payment" ? "#10b981" : "#ef4444",
                                                    }}>
                                                        {tx.type === "payment" ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: 14 }}>{tx.description}</div>
                                                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{new Date(tx.created_at).toLocaleString("tr-TR")}</div>
                                                    </div>
                                                </div>
                                                <div style={{ fontWeight: 700, color: tx.type === "payment" ? "#10b981" : "#ef4444" }}>
                                                    {tx.type === "payment" ? "+" : "-"}{fmt(tx.amount)}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* PAY DEBT TAB */}
                            {activeTab === "pay" && (
                                <div style={{ padding: 24 }}>
                                    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Kredi Kartı Borç Ödeme</h3>
                                    <form onSubmit={(e) => handlePayDebt(e, card.id)} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 400 }}>
                                        <div>
                                            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Ödeme Yapılacak Hesap</label>
                                            <select required value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)} style={inputStyle}>
                                                <option value="">Hesap Seçin</option>
                                                {accounts.map(acc => (
                                                    <option key={acc.account_id} value={acc.account_id}>{acc.account_name || acc.account_type} - {fmt(acc.balance)}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Ödenecek Tutar (TRY)</label>
                                            <input type="number" required min="1" max={card.current_debt} step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder={`Maksimum: ${fmt(card.current_debt)}`} style={inputStyle} />
                                        </div>
                                        <button type="submit" disabled={actionLoading || card.current_debt === 0} style={{
                                            background: "linear-gradient(135deg, #ef4444, #dc2626)", color: "white", border: "none",
                                            padding: "14px", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer",
                                            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                                            opacity: actionLoading || card.current_debt === 0 ? 0.6 : 1,
                                        }}>
                                            {actionLoading ? <RefreshCw size={18} style={{ animation: "spin 1s linear infinite" }} /> : <DollarSign size={18} />}
                                            Borcu Öde
                                        </button>
                                    </form>
                                </div>
                            )}

                            {/* SIMULATE PURCHASE TAB */}
                            {activeTab === "simulate" && (
                                <div style={{ padding: 24 }}>
                                    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Harcama Simülasyonu</h3>
                                    <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>Test amaçlı olarak kredi kartınızdan harcama yapabilirsiniz.</p>
                                    <form onSubmit={(e) => handlePurchase(e, card.id)} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 400 }}>
                                        <div>
                                            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Harcama Tutarı (TRY)</label>
                                            <input type="number" required min="1" max={card.available_limit} step="0.01" value={purchaseAmount} onChange={(e) => setPurchaseAmount(e.target.value)} placeholder={`Maksimum: ${fmt(card.available_limit)}`} style={inputStyle} />
                                        </div>
                                        <div>
                                            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Açıklama</label>
                                            <input type="text" required value={purchaseDesc} onChange={(e) => setPurchaseDesc(e.target.value)} placeholder="Ör: Market, Restoran" style={inputStyle} />
                                        </div>
                                        <button type="submit" disabled={actionLoading || card.available_limit <= 0} style={{
                                            background: "linear-gradient(135deg, #6366f1, #818cf8)", color: "white", border: "none",
                                            padding: "14px", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer",
                                            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                                            opacity: actionLoading || card.available_limit <= 0 ? 0.6 : 1,
                                        }}>
                                            {actionLoading ? <RefreshCw size={18} style={{ animation: "spin 1s linear infinite" }} /> : <ShoppingCart size={18} />}
                                            Harcama Yap
                                        </button>
                                    </form>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
