import { useState, useEffect } from "react";
import { ArrowLeftRight, TrendingUp, RefreshCw } from "lucide-react";
import { exchangeApi } from "../services/api";

const FLAGS = { TRY: "🇹🇷", USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", CHF: "🇨🇭", XAU: "🥇" };
const NAMES = { TRY: "Türk Lirası", USD: "ABD Doları", EUR: "Euro", GBP: "İngiliz Sterlini", CHF: "İsviçre Frangı", XAU: "Altın (Ons)" };

export default function ExchangeRatesPage() {
    const [rates, setRates] = useState({});
    const [fromCurrency, setFromCurrency] = useState("USD");
    const [toCurrency, setToCurrency] = useState("TRY");
    const [amount, setAmount] = useState("100");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRates = async () => {
            try {
                const res = await exchangeApi.getRates();
                setRates(res.data.rates);
            } catch {
                setRates({ USD: 32.50, EUR: 35.20, GBP: 41.10, TRY: 1.0 });
            }
            setLoading(false);
        };
        fetchRates();
    }, []);

    const convert = () => {
        if (!amount || !rates[fromCurrency] || !rates[toCurrency]) return "0.00";
        const inTRY = parseFloat(amount) * (rates[fromCurrency] || 1);
        const result = inTRY / (rates[toCurrency] || 1);
        return result.toFixed(2);
    };

    const swap = () => {
        setFromCurrency(toCurrency);
        setToCurrency(fromCurrency);
    };

    const fmt = (n) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(n);

    return (
        <div style={{ padding: "24px", maxWidth: 800, margin: "0 auto" }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
                <TrendingUp size={28} color="#10b981" /> Döviz Kurları
            </h1>

            {/* Rate Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 32 }}>
                {Object.entries(rates).filter(([k]) => k !== "TRY").map(([currency, rate]) => (
                    <div key={currency} style={{
                        background: "var(--bg-card)", borderRadius: 16, padding: 20,
                        border: "1px solid var(--border-color)", textAlign: "center",
                    }}>
                        <div style={{ fontSize: 32, marginBottom: 4 }}>{FLAGS[currency]}</div>
                        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>{currency}/TRY</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: "#10b981" }}>₺{fmt(rate)}</div>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>{NAMES[currency]}</div>
                    </div>
                ))}
            </div>

            {/* Converter */}
            <div style={{
                background: "var(--bg-card)", borderRadius: 20, padding: 32,
                border: "1px solid var(--border-color)",
            }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>💱 Döviz Çevirici</h2>

                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    {/* From */}
                    <div style={{ flex: 1, minWidth: 160 }}>
                        <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Kaynak</label>
                        <select value={fromCurrency} onChange={(e) => setFromCurrency(e.target.value)} style={selectStyle}>
                            {Object.keys(rates).map((c) => <option key={c} value={c}>{FLAGS[c]} {c}</option>)}
                        </select>
                        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                            style={{ ...inputStyle, marginTop: 8 }} placeholder="Tutar" />
                    </div>

                    {/* Swap */}
                    <button onClick={swap} style={{
                        width: 44, height: 44, borderRadius: "50%", border: "none", cursor: "pointer",
                        background: "linear-gradient(135deg, #6366f1, #818cf8)", color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        marginTop: 16,
                    }}>
                        <ArrowLeftRight size={20} />
                    </button>

                    {/* To */}
                    <div style={{ flex: 1, minWidth: 160 }}>
                        <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Hedef</label>
                        <select value={toCurrency} onChange={(e) => setToCurrency(e.target.value)} style={selectStyle}>
                            {Object.keys(rates).map((c) => <option key={c} value={c}>{FLAGS[c]} {c}</option>)}
                        </select>
                        <div style={{
                            ...inputStyle, marginTop: 8, fontSize: 18, fontWeight: 700, color: "#10b981",
                            display: "flex", alignItems: "center",
                        }}>
                            {FLAGS[toCurrency]} {convert()}
                        </div>
                    </div>
                </div>

                <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 16, textAlign: "center" }}>
                    💡 Kurlar bilgilendirme amaçlıdır. İşlem kurları farklılık gösterebilir.
                </p>
            </div>
        </div>
    );
}

const inputStyle = {
    padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border-color)",
    background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14,
    outline: "none", width: "100%", boxSizing: "border-box",
};
const selectStyle = {
    ...inputStyle, appearance: "none", cursor: "pointer",
};
