import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

const ROLE_REDIRECTS = {
    customer: "/customer/dashboard",
    employee: "/employee/dashboard",
    ceo: "/executive/cockpit",
    admin: "/admin/dashboard",
};

export function getRoleRedirectPath(role) {
    return ROLE_REDIRECTS[role] || "/";
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem("token");
        const savedUser = localStorage.getItem("user");
        if (token && savedUser) {
            try {
                setUser(JSON.parse(savedUser));
            } catch {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
            }
        }
        setLoading(false);
    }, []);

    const login = (token, userData) => {
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(userData));
        setUser(userData);
    };

    const logout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
    };

    const isAuthenticated = !!user;
    const isAdmin = user?.role === "admin";
    const isEmployee = user?.role === "employee";
    const isCeo = user?.role === "ceo";
    const isCustomer = user?.role === "customer";
    const isStaff = isEmployee || isAdmin;
    const isManagement = isCeo || isAdmin;
    const hasRole = (...roles) => roles.includes(user?.role);

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                login,
                logout,
                isAuthenticated,
                isAdmin,
                isEmployee,
                isCeo,
                isCustomer,
                isStaff,
                isManagement,
                hasRole,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}

