import { Link } from "react-router-dom";
import { Home, ArrowLeft, Search } from "lucide-react";

export default function NotFoundPage() {
    return (
        <div style={{
            minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
            background: "var(--bg-primary)", padding: 24,
        }}>
            <div style={{ textAlign: "center", maxWidth: 480 }}>
                <div style={{
                    fontSize: 120, fontWeight: 800, letterSpacing: -4,
                    color: "var(--accent)", lineHeight: 1, marginBottom: 8,
                    opacity: 0.3,
                }}>
                    404
                </div>
                <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
                    Sayfa Bulunamadı
                </h1>
                <p style={{ color: "var(--text-muted)", fontSize: 15, marginBottom: 32, lineHeight: 1.6 }}>
                    Aradığınız sayfa taşınmış, silinmiş veya hiç var olmamış olabilir.
                    Lütfen adresi kontrol edin veya ana sayfaya dönün.
                </p>
                <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                    <Link to="/" className="btn btn-primary" style={{ display: "inline-flex", gap: 6 }}>
                        <Home size={16} /> Ana Sayfaya Dön
                    </Link>
                    <button
                        className="btn btn-outline"
                        onClick={() => window.history.back()}
                        style={{ display: "inline-flex", gap: 6 }}
                    >
                        <ArrowLeft size={16} /> Geri Git
                    </button>
                </div>
            </div>
        </div>
    );
}
