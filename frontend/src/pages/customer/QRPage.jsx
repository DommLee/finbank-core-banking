import { useState, useEffect, useRef } from "react";
import QRCode from "react-qr-code";
import { Html5QrcodeScanner, Html5Qrcode } from "html5-qrcode";
import { toast } from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { accountApi, transactionApi } from "../../services/api";
import { QrCode, Scan, ArrowRight, RefreshCw, XCircle } from "lucide-react";

export default function QRPage() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState("receive"); // "receive" | "scan"

    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedAccount, setSelectedAccount] = useState("");
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");

    const [qrValue, setQrValue] = useState("");

    // Scanner state
    const [scanResult, setScanResult] = useState(null);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        loadAccounts();
    }, []);

    const loadAccounts = async () => {
        try {
            const res = await accountApi.listMine();
            const activeAccounts = Array.isArray(res.data)
                ? res.data.filter(a => a.status === "active")
                : res.data?.data?.filter(a => a.status === "active") || [];

            setAccounts(activeAccounts);
            if (activeAccounts.length > 0) {
                setSelectedAccount(activeAccounts[0].id || activeAccounts[0].account_id);
            }
        } catch (error) {
            toast.error("Hesaplar yüklenirken hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    // Generate QR string
    useEffect(() => {
        if (!selectedAccount) return;
        const targetAcc = accounts.find(a => (a.id || a.account_id) === selectedAccount);
        if (!targetAcc) return;

        const data = {
            type: "FINBANK_QR",
            alias: targetAcc.iban || targetAcc.account_number,
            name: user?.name || "Kullanıcı",
            amount: amount ? Number(amount) : null,
            desc: description
        };
        setQrValue(JSON.stringify(data));
    }, [selectedAccount, amount, description, accounts, user]);

    // Handle scanner initialization
    useEffect(() => {
        if (activeTab === "scan") {
            const scanner = new Html5QrcodeScanner("reader", {
                qrbox: { width: 250, height: 250 },
                fps: 5,
            });

            scanner.render(
                (decodedText) => {
                    try {
                        const parsed = JSON.parse(decodedText);
                        if (parsed.type === "FINBANK_QR" && parsed.alias) {
                            scanner.clear();
                            setScanResult(parsed);
                        } else {
                            toast.error("Geçersiz veya desteklenmeyen QR kod.");
                        }
                    } catch (e) {
                        toast.error("QR kod okunamadı.");
                    }
                },
                (error) => {
                    // console.warn(error);
                }
            );

            return () => {
                scanner.clear().catch(e => console.error("Scanner cleanup failed", e));
            };
        }
    }, [activeTab]);

    const handlePay = async (e) => {
        e.preventDefault();
        if (!scanResult || !selectedAccount) return;

        setProcessing(true);
        try {
            const target = scanResult.alias.trim();
            const payload = {
                from_account_id: selectedAccount,
                amount: Number(scanResult.amount),
                description: scanResult.desc ? `QR: ${scanResult.desc}` : "QR ile Ödeme"
            };

            if (target.toUpperCase().startsWith("TR")) {
                payload.target_iban = target;
            } else if (/^[a-f\d]{24}$/i.test(target)) {
                payload.to_account_id = target;
            } else {
                payload.target_alias = target;
            }

            await transactionApi.transfer(payload);
            toast.success("Ödeme başarıyla gerçekleşti!");
            setScanResult(null);
            setActiveTab("receive");
            await loadAccounts(); // refresh balance
        } catch (error) {
            toast.error(error.response?.data?.detail || "Ödeme yapılamadı.");
        } finally {
            setProcessing(false);
        }
    };

    if (loading) return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}><div className="spinner" /></div>;

    return (
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <div className="page-header" style={{ marginBottom: 24 }}>
                <h1>QR İşlemleri</h1>
                <p>QR kod ile hızlıca ödeme alın veya ödeme yapın.</p>
            </div>

            <div style={{ display: "flex", gap: 8, background: "var(--bg-secondary)", padding: 6, borderRadius: 16, marginBottom: 24 }}>
                <button
                    onClick={() => { setActiveTab("receive"); setScanResult(null); }}
                    style={tabStyle(activeTab === "receive")}
                >
                    <QrCode size={18} />
                    Ödeme Al (QR Üret)
                </button>
                <button
                    onClick={() => setActiveTab("scan")}
                    style={tabStyle(activeTab === "scan")}
                >
                    <Scan size={18} />
                    Ödeme Yap (Tara)
                </button>
            </div>

            {activeTab === "receive" && (
                <div style={{ background: "var(--bg-card)", padding: 24, borderRadius: 24, border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: 24 }}>
                    <div style={{ display: "flex", justifyContent: "center", background: "#fff", padding: 20, borderRadius: 16, width: "fit-content", margin: "0 auto" }}>
                        <QRCode value={qrValue || "empty"} size={200} level="H" />
                    </div>

                    <div style={{ display: "grid", gap: 16 }}>
                        <div>
                            <label style={labelStyle}>Ödemenin Yansıyacağı Hesap</label>
                            <select
                                className="form-select"
                                value={selectedAccount}
                                onChange={e => setSelectedAccount(e.target.value)}
                            >
                                {accounts.map(a => (
                                    <option key={a.id || a.account_id} value={a.id || a.account_id}>
                                        {a.account_number} (Bakiye: {a.balance} TL)
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div style={{ display: "flex", gap: 16 }}>
                            <div style={{ flex: 1 }}>
                                <label style={labelStyle}>Tutar (Opsiyonel)</label>
                                <input
                                    className="form-input"
                                    type="number" min="0.01" step="0.01"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        <div>
                            <label style={labelStyle}>Açıklama (Opsiyonel)</label>
                            <input
                                className="form-input"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Örn: Akşam yemeği"
                            />
                        </div>
                    </div>
                </div>
            )}

            {activeTab === "scan" && (
                <div>
                    {!scanResult ? (
                        <div style={{ background: "var(--bg-card)", padding: 20, borderRadius: 24, border: "1px solid var(--border-color)", overflow: "hidden" }}>
                            <div id="reader" style={{ width: "100%", border: "none" }}></div>
                        </div>
                    ) : (
                        <div style={{ background: "var(--bg-card)", padding: 24, borderRadius: 24, border: "1px solid var(--border-color)", display: "grid", gap: 20 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Ödeme Bilgileri</h3>
                                <button onClick={() => setScanResult(null)} style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}><XCircle size={24} /></button>
                            </div>

                            <div style={{ background: "var(--bg-secondary)", padding: 16, borderRadius: 16 }}>
                                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Alıcı</div>
                                <div style={{ fontSize: 18, fontWeight: 700, margin: "4px 0" }}>{scanResult.name}</div>
                                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Hesap / IBAN: {scanResult.alias}</div>
                                {scanResult.desc && <div style={{ fontSize: 13, marginTop: 8, fontStyle: "italic" }}>Açıklama: {scanResult.desc}</div>}
                            </div>

                            <form onSubmit={handlePay} style={{ display: "grid", gap: 16 }}>
                                <div>
                                    <label style={labelStyle}>Ödenecek Tutar</label>
                                    <input
                                        className="form-input"
                                        type="number" min="0.01" step="0.01" required
                                        value={scanResult.amount || ""}
                                        onChange={e => setScanResult({ ...scanResult, amount: e.target.value })}
                                        disabled={!!qrValue && JSON.parse(qrValue || "{}").amount} // disabled if QR had fixed amount
                                        style={{ fontSize: 24, fontWeight: 800, padding: "16px" }}
                                    />
                                </div>

                                <div>
                                    <label style={labelStyle}>Gönderilecek Hesap</label>
                                    <select
                                        className="form-select"
                                        value={selectedAccount}
                                        onChange={e => setSelectedAccount(e.target.value)}
                                        required
                                    >
                                        <option value="" disabled>Hesap Seçin</option>
                                        {accounts.map(a => (
                                            <option key={a.id || a.account_id} value={a.id || a.account_id}>
                                                {a.account_number} (Bakiye: {a.balance} TL)
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <button type="submit" style={{ ...primaryButtonStyle, marginTop: 8 }} disabled={processing}>
                                    {processing ? <RefreshCw size={20} style={{ animation: "spin 1s linear infinite" }} /> : <><ArrowRight size={20} /> Ödemeyi Tamamla</>}
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            )}
            <style>{`
                #reader button {
                    background: #f59e0b;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    padding: 8px 16px;
                    font-weight: 600;
                    margin-top: 10px;
                    cursor: pointer;
                }
                #reader select {
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    padding: 8px;
                    margin-bottom: 10px;
                }
                #reader a { display: none; }
            `}</style>
        </div>
    );
}

const tabStyle = (active) => ({
    flex: 1,
    padding: "12px 16px",
    border: "none",
    background: active ? "var(--bg-card)" : "transparent",
    color: active ? "var(--text-primary)" : "var(--text-secondary)",
    fontWeight: active ? 800 : 600,
    fontSize: 14,
    borderRadius: 12,
    cursor: "pointer",
    transition: "all 0.2s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    boxShadow: active ? "0 2px 8px rgba(0,0,0,0.05)" : "none"
});

const labelStyle = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-secondary)",
    marginBottom: 8,
};

const primaryButtonStyle = {
    background: "#f59e0b",
    color: "#fff",
    border: "none",
    padding: "16px",
    borderRadius: 16,
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    transition: "all 0.2s",
};
