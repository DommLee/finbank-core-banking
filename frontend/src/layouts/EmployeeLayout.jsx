import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
    ArrowLeftRight,
    BookOpen,
    Briefcase,
    CreditCard,
    LayoutDashboard,
    LogOut,
    MessageSquare,
    Moon,
    Sun,
    UserCog,
    Users,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function EmployeeLayout() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("theme", theme);
    }, [theme]);

    const links = [
        { to: "/employee/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { to: "/employee/portal", label: "Musteri ops", icon: Briefcase },
        { to: "/employee/customers", label: "Musteriler", icon: Users },
        { to: "/employee/accounts", label: "Hesaplar", icon: CreditCard },
        { to: "/employee/transfer", label: "Transfer", icon: ArrowLeftRight },
        { to: "/employee/ledger", label: "Defter", icon: BookOpen },
        { to: "/employee/messages", label: "Mesajlar", icon: MessageSquare },
    ];

    const isActive = (path) => location.pathname === path;

    return (
        <div className="layout-wrapper layout-employee">
            <aside className="sidebar sidebar-employee" role="navigation" aria-label="Employee menu">
                <div className="sidebar-brand">
                    <div className="sidebar-brand-icon employee-icon">FB</div>
                    <span className="sidebar-brand-text">FinBank</span>
                    <span className="sidebar-brand-sub">Employee workspace</span>
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
                        <UserCog size={16} />
                        <div className="sidebar-user-info">
                            <span className="sidebar-role-badge employee">Employee</span>
                            <span className="sidebar-email">{user?.email}</span>
                        </div>
                    </div>
                    <button
                        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                        className="btn-logout"
                        style={{ marginBottom: 8, background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
                        aria-label="Toggle theme"
                    >
                        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                        {theme === "dark" ? " Light" : " Dark"}
                    </button>
                    <button className="btn-logout" onClick={logout} aria-label="Logout">
                        <LogOut size={16} /> Logout
                    </button>
                </div>
            </aside>

            <div className="mobile-header">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="sidebar-brand-icon employee-icon" style={{ width: 32, height: 32, fontSize: 12 }}>FB</div>
                    <span style={{ fontWeight: 700 }}>Employee</span>
                </div>
                <button
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    style={{ background: "none", border: "none", color: "var(--text-primary)", cursor: "pointer" }}
                    aria-label="Toggle theme"
                >
                    {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
                </button>
            </div>

            <nav className="bottom-nav" role="navigation" aria-label="Employee mobile navigation">
                {links.slice(0, 4).map((link) => (
                    <Link
                        key={link.to}
                        to={link.to}
                        className={`bottom-nav-item ${isActive(link.to) ? "active" : ""}`}
                        aria-current={isActive(link.to) ? "page" : undefined}
                    >
                        <link.icon size={20} />
                        <span>{link.label}</span>
                    </Link>
                ))}
            </nav>

            <main className="layout-main">
                <Outlet />
            </main>
        </div>
    );
}

