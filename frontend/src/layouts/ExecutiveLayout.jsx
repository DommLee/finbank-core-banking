import { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
    LogOut, Crown, Moon, Sun, MessageSquare, Menu,
} from "lucide-react";
import MobileBottomNav from "../components/MobileBottomNav";

export default function ExecutiveLayout() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("theme", theme);
    }, [theme]);

    const links = [
        { to: "/executive/cockpit", label: "Kontrol Paneli", icon: LayoutDashboard },
        { to: "/executive/reports", label: "Raporlar", icon: BarChart3 },
        { to: "/executive/audit", label: "Denetim", icon: Shield },
        { to: "/executive/messages", label: "Mesajlar", icon: MessageSquare },
    ];

    const isActive = (path) => location.pathname === path;

    return (
        <div className="layout-wrapper layout-executive">
            {/* Overlay for mobile */}
            <div
                className={`sidebar-overlay ${sidebarOpen ? 'mobile-open' : ''}`}
                onClick={() => setSidebarOpen(false)}
            />

            <aside className={`sidebar sidebar-executive ${sidebarOpen ? 'mobile-open' : ''}`} role="navigation" aria-label="Yönetim menüsü">
                <div className="sidebar-brand">
                    <div className="sidebar-brand-icon executive-icon">FB</div>
                    <span className="sidebar-brand-text">FinBank</span>
                    <span className="sidebar-brand-sub">Yönetim</span>
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
                    <div className="sidebar-user">
                        <Crown size={16} />
                        <div className="sidebar-user-info">
                            <span className="sidebar-role-badge executive">CEO</span>
                            <span className="sidebar-email">{user?.email}</span>
                        </div>
                    </div>
                    <button
                        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                        className="btn-logout"
                        style={{ marginBottom: 8, background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
                        aria-label="Tema değiştir"
                    >
                        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                        {theme === "dark" ? " Açık Mod" : " Koyu Mod"}
                    </button>
                    <button className="btn-logout" onClick={logout} aria-label="Çıkış yap">
                        <LogOut size={16} /> Çıkış
                    </button>
                </div>
            </aside>

            {/* ── Mobile Header ── */}
            <div className="mobile-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, padding: "0 16px" }}>
                <button
                    onClick={() => setSidebarOpen(true)}
                    style={{ background: 'var(--bg-card)', border: 'none', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                >
                    <Menu size={20} />
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="sidebar-brand-icon executive-icon" style={{ width: 32, height: 32, fontSize: 12 }}>FB</div>
                    <span style={{ fontWeight: 700, color: "#d4af37" }}>CEO</span>
                </div>
                <button
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    style={{ background: 'var(--bg-card)', border: 'none', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                >
                    {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
                </button>
            </div>

            <MobileBottomNav />

            <main className="layout-main">
                <Outlet />
            </main>
        </div>
    );
}
