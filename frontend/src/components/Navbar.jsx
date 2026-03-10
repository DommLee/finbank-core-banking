import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
    LayoutDashboard, CreditCard, ArrowLeftRight,
    BookOpen, Shield, LogOut,
} from "lucide-react";

export default function Navbar() {
    const { user, logout, isAdmin } = useAuth();
    const location = useLocation();

    const links = [
        { to: "/", label: "Panel", icon: LayoutDashboard },
        { to: "/accounts", label: "Hesaplar", icon: CreditCard },
        { to: "/transfer", label: "Transfer", icon: ArrowLeftRight },
        { to: "/ledger", label: "Hesap Defteri", icon: BookOpen },
    ];

    if (isAdmin) {
        links.push({ to: "/audit", label: "Denetim", icon: Shield });
    }

    const isActive = (path) => location.pathname === path;

    return (
        <nav className="navbar" role="navigation" aria-label="Ana navigasyon">
            <Link to="/" className="navbar-brand">
                <div className="navbar-brand-icon">FB</div>
                <span className="navbar-brand-text">FinBank</span>
            </Link>

            <div className="navbar-links">
                {links.map((link) => (
                    <Link
                        key={link.to}
                        to={link.to}
                        className={`nav-link ${isActive(link.to) ? "active" : ""}`}
                        aria-current={isActive(link.to) ? "page" : undefined}
                    >
                        <link.icon size={16} />
                        {link.label}
                    </Link>
                ))}
            </div>

            <div className="navbar-user">
                <span className={`user-badge ${isAdmin ? "admin" : ""}`}>
                    {user?.role === "admin" ? "Yönetici" : "Müşteri"}
                </span>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    {user?.email}
                </span>
                <button
                    className="btn-logout"
                    onClick={logout}
                    aria-label="Çıkış yap"
                >
                    <LogOut size={14} />
                </button>
            </div>
        </nav>
    );
}
