import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
    Home,
    Wallet,
    CreditCard,
    User,
    Users,
    Briefcase,
    TrendingUp,
    Shield
} from "lucide-react";

export default function MobileBottomNav() {
    const { user } = useAuth();
    if (!user) return null;

    let links = [];

    switch (user.role) {
        case "customer":
            links = [
                { path: "/customer/dashboard", label: "Ana Sayfa", icon: Home },
                { path: "/customer/transfer", label: "Transfer", icon: TrendingUp },
                { path: "/customer/cards", label: "Kartlar", icon: CreditCard },
                { path: "/customer/profile", label: "Profil", icon: User },
            ];
            break;
        case "employee":
            links = [
                { path: "/employee/dashboard", label: "Panel", icon: Home },
                { path: "/employee/customers", label: "Müşteriler", icon: Users },
                { path: "/employee/transfer", label: "İşlem", icon: TrendingUp },
                { path: "/employee/messages", label: "Mesaj", icon: Briefcase },
            ];
            break;
        case "ceo":
            links = [
                { path: "/executive/cockpit", label: "Kokpit", icon: Shield },
                { path: "/executive/reports", label: "Raporlar", icon: Briefcase },
                { path: "/executive/audit", label: "Denetim", icon: Users },
                { path: "/executive/messages", label: "Mesajlar", icon: User },
            ];
            break;
        case "admin":
            links = [
                { path: "/admin/dashboard", label: "Admin", icon: Shield },
                { path: "/admin/customers", label: "Üyeler", icon: Users },
                { path: "/admin/transfer", label: "Transfer", icon: TrendingUp },
                { path: "/admin/audit", label: "Loglar", icon: Briefcase },
            ];
            break;
        default:
            return null;
    }

    return (
        <div className="bottom-nav">
            {links.map((link) => {
                const Icon = link.icon;
                return (
                    <NavLink
                        key={link.path}
                        to={link.path}
                        className={({ isActive }) => `bottom-nav-item ${isActive ? "active" : ""}`}
                    >
                        <Icon size={20} className="mb-0.5" />
                        <span>{link.label}</span>
                    </NavLink>
                );
            })}
        </div>
    );
}
