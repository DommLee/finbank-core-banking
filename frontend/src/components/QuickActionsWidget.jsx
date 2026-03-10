import React from "react";
import { Link } from "react-router-dom";
import {
    Send, Receipt, Target,
    TrendingUp, BarChart3, Shield, MessageSquare, Bell, CreditCard,
} from "lucide-react";

export default function QuickActionsWidget({ role = "customer" }) {
    const actions = role === "customer" ? [
        { to: `/${role}/transfer`, label: "Para Transferi", icon: <Send size={20} />, color: "#3b82f6" },
        { to: `/${role}/cards`, label: "Kredi Kartlarım", icon: <CreditCard size={20} />, color: "#8b5cf6" },
        { to: `/${role}/bills`, label: "Fatura Öde", icon: <Receipt size={20} />, color: "#f59e0b" },
        { to: `/${role}/goals`, label: "Tasarruf", icon: <Target size={20} />, color: "#22c55e" },
        { to: `/${role}/exchange`, label: "Döviz", icon: <TrendingUp size={20} />, color: "#3b82f6" },
        { to: `/${role}/spending`, label: "Analiz", icon: <BarChart3 size={20} />, color: "#8b5cf6" },
        { to: `/${role}/security`, label: "Güvenlik", icon: <Shield size={20} />, color: "#ef4444" },
        { to: `/${role}/messages`, label: "Mesajlar", icon: <MessageSquare size={20} />, color: "#14b8a6" },
        { to: `/${role}/notifications`, label: "Bildirimler", icon: <Bell size={20} />, color: "#ec4899" },
    ] : [];

    return (
        <div style={{
            background: "var(--bg-card)", borderRadius: 20, padding: 24,
            border: "1px solid var(--border-color)",
        }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18 }}>⚡ Hızlı İşlemler</h3>
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(85px, 1fr))",
                gap: 10,
            }}>
                {actions.map((a) => (
                    <Link key={a.to} to={a.to} style={{
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                        padding: 14, borderRadius: 14, background: "var(--bg-secondary)",
                        textDecoration: "none", color: "var(--text-primary)",
                        transition: "all 0.25s", border: "1px solid transparent",
                    }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = a.color; e.currentTarget.style.transform = "translateY(-2px)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.transform = "translateY(0)"; }}
                    >
                        <div style={{
                            width: 42, height: 42, borderRadius: 12,
                            background: `${a.color}18`, display: "flex", alignItems: "center", justifyContent: "center",
                            color: a.color,
                        }}>{a.icon}</div>
                        <span style={{ fontSize: 11, fontWeight: 600, textAlign: "center" }}>{a.label}</span>
                    </Link>
                ))}
            </div>
        </div>
    );
}
