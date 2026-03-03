import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "/api/v1";

const api = axios.create({
    baseURL: API_BASE,
    headers: { "Content-Type": "application/json" },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle 401 responses globally
api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.location.href = "/login";
        }
        return Promise.reject(err);
    }
);

// ── Auth ──
export const authApi = {
    register: (data) => api.post("/auth/register", data),
    login: (data) => api.post("/auth/login", data),
    getMe: () => api.get("/auth/me"),
    verifyEmail: (data) => api.post("/auth/verify-email", data),
    resendCode: (data) => api.post("/auth/resend-code", data),
};

// ── Customers ──
export const customerApi = {
    create: (data) => api.post("/customers/", data),
    getMe: () => api.get("/customers/me"),
    getProfile: () => api.get("/customers/me"),
    updateMe: (data) => api.put("/customers/me", data),
    listAll: () => api.get("/customers/"),
    updateStatus: (id, data) => api.patch(`/customers/${id}/status`, data),
    submitKYC: (data) => api.post("/customers/kyc", data),
    changePassword: (data) => api.post("/auth/change-password", data),
};

// ── Accounts ──
export const accountApi = {
    create: (data) => api.post("/accounts/", data),
    listMine: () => api.get("/accounts/"),
    getBalance: (id) => api.get(`/accounts/${id}/balance`),
    listAll: () => api.get("/accounts/all"),
    listByCustomer: (customerId) => api.get(`/accounts/customer/${customerId}`),
};

// ── Transactions ──
export const transactionApi = {
    deposit: (data) => api.post("/transactions/deposit", data),
    withdraw: (data) => api.post("/transactions/withdraw", data),
    transfer: (data) => api.post("/transactions/transfer", data),
};

// ── Ledger ──
export const ledgerApi = {
    getEntries: (params) => api.get("/ledger/", { params }),
};

// ── Audit ──
export const auditApi = {
    getLogs: (params) => api.get("/audit/", { params }),
};

// ── Messages ──
export const messagesApi = {
    send: (data) => api.post("/messages/", data),
    inbox: () => api.get("/messages/inbox"),
    reply: (id, data) => api.post(`/messages/${id}/reply`, data),
    markRead: (id) => api.patch(`/messages/${id}/read`),
};

// ── Bills ──
export const billApi = {
    getBills: () => api.get('/bills/'),
    payBill: (billId, from_account_id) => api.post(`/bills/${billId}/pay`, { from_account_id }),
};

// Bills alias with methods matching BillPayPage expectations
export const billsApi = {
    history: () => api.get('/bills/history'),
    pay: (data) => api.post('/bills/pay', data),
};

export const cardsApi = {
    getMyCards: () => api.get('/cards/'),
    applyForCard: (data) => api.post('/cards/apply', data),
    payCardDebt: (cardId, from_account_id, amount) => api.post(`/cards/${cardId}/pay`, { from_account_id, amount }),
    getCardTransactions: (cardId) => api.get(`/cards/${cardId}/transactions`),
    purchase: (cardId, amount, description) => api.post(`/cards/${cardId}/purchase?amount=${amount}&description=${description}`),
};

export const exchangeApi = {
    getRates: () => api.get('/exchange/rates'),
};

// ── Card Controls ──
export const cardControlsApi = {
    toggleFreeze: (accountId) => api.patch(`/accounts/${accountId}/toggle-freeze`),
};

// Alias for CardControlsPage.jsx
export const cardApi = cardControlsApi;

// ── Chatbot (Gemini AI) ──
export const chatbotApi = {
    send: (data) => api.post("/chatbot/chat", data),
    history: (sessionId) => api.get(`/chatbot/history/${sessionId}`),
};

// ── Notifications ──
export const notificationApi = {
    list: () => api.get("/notifications"),
    unreadCount: () => api.get("/notifications/unread-count"),
    markRead: (id) => api.patch(`/notifications/${id}/read`),
    markAllRead: () => api.patch("/notifications/read-all"),
};

// ── Savings Goals ──
export const goalsApi = {
    create: (data) => api.post("/goals", data),
    list: () => api.get("/goals"),
    contribute: (id, data) => api.post(`/goals/${id}/contribute`, data),
    delete: (id) => api.delete(`/goals/${id}`),
};

// ── Sessions ──
export const sessionApi = {
    list: () => api.get("/auth/sessions"),
    delete: (id) => api.delete(`/auth/sessions/${id}`),
    deleteAll: () => api.delete("/auth/sessions"),
};

// ── Login History ──
export const loginHistoryApi = {
    list: () => api.get("/auth/login-history"),
};

// ── 2FA ──
export const twoFactorApi = {
    setup: () => api.post("/auth/2fa/setup"),
    verify: (code) => api.post(`/auth/2fa/verify?code=${code}`),
    disable: () => api.delete("/auth/2fa/disable"),
};

// ── Admin ──
export const adminApi = {
    listUsers: (params) => api.get("/admin/users", { params }),
    getUser: (id) => api.get(`/admin/users/${id}`),
    changeRole: (id, data) => api.patch(`/admin/users/${id}/role`, data),
    toggleStatus: (id, data) => api.patch(`/admin/users/${id}/status`, data),
    deleteUser: (id) => api.delete(`/admin/users/${id}`),
    systemStats: () => api.get("/admin/system/stats"),
    allMessages: (params) => api.get("/admin/all-messages", { params }),
    allBills: (params) => api.get("/admin/all-bills", { params }),
};

// ── Employee ──
export const employeeApi = {
    pendingKYC: () => api.get("/employee/kyc/pending"),
    allKYC: (params) => api.get("/employee/kyc/all", { params }),
    kycDecision: (id, data) => api.patch(`/employee/kyc/${id}/decision`, data),
    searchCustomers: (params) => api.get("/employee/customers", { params }),
    getCustomer: (id) => api.get(`/employee/customers/${id}`),
    dashboard: () => api.get("/employee/dashboard"),
};

// ── Analytics ──
export const analyticsApi = {
    overview: () => api.get("/stats/overview"),
    spendingAnalysis: () => api.get("/spending-analysis"),
    dailyTrends: (params) => api.get("/spending-analysis/daily", { params }),
    auditLogs: (params) => api.get("/audit-logs", { params }),
    monthlyReport: (params) => api.get("/reports/monthly", { params }),
};

export default api;
