import { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import NotificationBell from "../components/NotificationBell";
import {
    LayoutDashboard, CreditCard, ArrowLeftRight,
    BookOpen, LogOut, User, Settings, Moon, Sun, MessageSquare,
    Receipt, Lock, Target, TrendingUp, BarChart3, Shield,
    FileCheck, History, Headphones
} from "lucide-react";


export default function CustomerLayout() {
    const { user, logout } = useAuth();
    const location = useLocation();

    // Theme state
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    const links = [
        { to: "/customer/dashboard", label: "Panel", icon: LayoutDashboard },
        { to: "/customer/accounts", label: "Hesaplar", icon: CreditCard },
        { to: "/customer/transfer", label: "Transfer", icon: ArrowLeftRight },
        { to: "/customer/history", label: "Geçmiş", icon: History },
        { to: "/customer/bills", label: "Fatura", icon: Receipt },
        { to: "/customer/cards", label: "Kredi Kartı", icon: CreditCard },
        { to: "/customer/ledger", label: "Hareketler", icon: BookOpen },
        { to: "/customer/goals", label: "Tasarruf", icon: Target },
        { to: "/customer/exchange", label: "Döviz", icon: TrendingUp },
        { to: "/customer/spending", label: "Analiz", icon: BarChart3 },
        { to: "/customer/messages", label: "Mesajlar", icon: MessageSquare },
        { to: "/customer/security", label: "Güvenlik", icon: Shield },
        { to: "/customer/kyc", label: "Kimlik (KYC)", icon: FileCheck },
        { to: "/customer/profile", label: "Profil", icon: User },
        { to: "/customer/contact", label: "İletişim", icon: Headphones },
    ];

    const isActive = (path) => location.pathname === path;

    return (
        <div className="layout-wrapper layout-customer">
            <aside className="sidebar" role="navigation" aria-label="Müşteri menüsü">
                <div className="sidebar-brand">
                    <div className="sidebar-brand-icon">FB</div>
                    <span className="sidebar-brand-text">FinBank</span>
                </div>

                <nav className="sidebar-nav">
                    {links.map((link) => (
                        <Link
                            key={link.to}
                            to={link.to}
                            className={`sidebar-link ${isActive(link.to) ? "active" : ""}`}
                            aria-current={isActive(link.to) ? "page" : undefined}
                        >
                            <link.icon size={18} />
                            <span>{link.label}</span>
                        </Link>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <button className="sidebar-link" onClick={toggleTheme} aria-label="Tema Değiştir">
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        <span>{theme === 'dark' ? 'Açık Tema' : 'Koyu Tema'}</span>
                    </button>
                    <div className="sidebar-user">
                        <User size={16} />
                        <div className="sidebar-user-info">
                            <span className="sidebar-role-badge customer">Müşteri</span>
                            <span className="sidebar-email">{user?.email}</span>
                        </div>
                    </div>
                    <button className="btn-logout" onClick={logout} aria-label="Çıkış yap">
                        <LogOut size={16} /> Çıkış
                    </button>
                </div>
            </aside>

            {/* ── Mobile Bottom Navigation ── */}
            <nav className="bottom-nav" role="navigation" aria-label="Mobil alt menü">
                {links.slice(0, 4).map((link) => (
                    <Link
                        key={link.to}
                        to={link.to}
                        className={`bottom-nav-item ${isActive(link.to) ? 'active' : ''}`}
                        aria-current={isActive(link.to) ? 'page' : undefined}
                    >
                        <link.icon size={28} />
                        <span style={{ fontSize: 10, marginTop: 4, fontWeight: isActive(link.to) ? 700 : 500 }}>{link.label}</span>
                    </Link>
                ))}
            </nav>

            <main className="layout-main">
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }} className="mobile-only-header">
                    <NotificationBell />
                    <button onClick={toggleTheme} style={{
                        background: 'var(--bg-card)', border: 'none', borderRadius: '50%',
                        width: 44, height: 44, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', color: 'var(--text-primary)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}>
                        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                </div>
                <Outlet />
            </main>
        </div>
    );
}
