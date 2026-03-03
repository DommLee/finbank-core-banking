import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth, getRoleRedirectPath } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import ChatbotWidget from "./components/ChatbotWidget";

// Layouts
import CustomerLayout from "./layouts/CustomerLayout";
import EmployeeLayout from "./layouts/EmployeeLayout";
import ExecutiveLayout from "./layouts/ExecutiveLayout";
import AdminLayout from "./layouts/AdminLayout";

// Shared Pages
import LoginPage from "./pages/LoginPage";
import LedgerPage from "./pages/LedgerPage";
import TransferPage from "./pages/TransferPage";
import AccountsPage from "./pages/AccountsPage";
import ProfilePage from "./pages/ProfilePage";
import NotFoundPage from "./pages/NotFoundPage";
import MessagesPage from "./pages/MessagesPage";
import BillsPage from './pages/customer/BillsPage';
import CardsPage from './pages/customer/CardsPage';
import AiChatbotPage from './pages/customer/AiChatbotPage';
import CustomerSupportPage from './pages/customer/CustomerSupportPage';

// Role Specific Pages
import DashboardPage from "./pages/DashboardPage";
import AuditPage from "./pages/AuditPage";
import EmployeePortalPage from "./pages/employee/EmployeePortalPage";
import ExecutiveCockpitPage from "./pages/executive/ExecutiveCockpitPage";

// New Feature Pages
import SavingsGoalsPage from "./pages/SavingsGoalsPage";
import ExchangeRatesPage from "./pages/ExchangeRatesPage";
import SecuritySettingsPage from "./pages/SecuritySettingsPage";
import SpendingAnalysisPage from "./pages/SpendingAnalysisPage";
import AdminPanelPage from "./pages/AdminPanelPage";
import EmployeePanelPage from "./pages/EmployeePanelPage";
import CEOReportsPage from "./pages/executive/CEOReportsPage";
import NotificationsPage from "./pages/NotificationsPage";
import KYCPage from "./pages/KYCPage";
import ContactPage from "./pages/ContactPage";
import TransferHistoryPage from "./pages/TransferHistoryPage";

export default function App() {
    const { isAuthenticated, user } = useAuth();

    return (
        <div className="app-container">
            <Routes>
                {/* Public */}
                <Route
                    path="/login"
                    element={isAuthenticated ? <Navigate to={getRoleRedirectPath(user?.role)} /> : <LoginPage />}
                />

                {/* Root Redirection */}
                <Route
                    path="/"
                    element={isAuthenticated ? <Navigate to={getRoleRedirectPath(user?.role)} /> : <Navigate to="/login" />}
                />

                {/* ── Customer Area ── */}
                <Route element={<CustomerLayout />}>
                    <Route path="/customer/dashboard" element={
                        <ProtectedRoute allowedRoles={['customer']}>
                            <DashboardPage />
                        </ProtectedRoute>
                    } />
                    <Route path="/customer/accounts" element={
                        <ProtectedRoute allowedRoles={['customer']}>
                            <AccountsPage />
                        </ProtectedRoute>
                    } />
                    <Route path="/customer/transfer" element={
                        <ProtectedRoute allowedRoles={['customer']}>
                            <TransferPage />
                        </ProtectedRoute>
                    } />
                    <Route path="/customer/ledger" element={
                        <ProtectedRoute allowedRoles={['customer']}>
                            <LedgerPage />
                        </ProtectedRoute>
                    } />
                    <Route path="/customer/profile" element={
                        <ProtectedRoute allowedRoles={['customer']}>
                            <ProfilePage />
                        </ProtectedRoute>
                    } />
                    <Route path="/customer/messages" element={
                        <ProtectedRoute allowedRoles={['customer']}>
                            <MessagesPage userRole="customer" />
                        </ProtectedRoute>
                    } />
                    <Route path="/customer/bills" element={
                        <ProtectedRoute allowedRoles={['customer']}>
                            <BillsPage />
                        </ProtectedRoute>
                    } />
                    <Route path="/customer/cards" element={
                        <ProtectedRoute allowedRoles={['customer']}>
                            <CardsPage />
                        </ProtectedRoute>
                    } />
                    <Route path="/customer/goals" element={
                        <ProtectedRoute allowedRoles={['customer']}>
                            <SavingsGoalsPage />
                        </ProtectedRoute>
                    } />
                    <Route path="/customer/exchange" element={
                        <ProtectedRoute allowedRoles={['customer']}>
                            <ExchangeRatesPage />
                        </ProtectedRoute>
                    } />
                    <Route path="/customer/security" element={
                        <ProtectedRoute allowedRoles={['customer']}>
                            <SecuritySettingsPage />
                        </ProtectedRoute>
                    } />
                    <Route path="/customer/spending" element={
                        <ProtectedRoute allowedRoles={['customer']}>
                            <SpendingAnalysisPage />
                        </ProtectedRoute>
                    } />
                    <Route path="/customer/notifications" element={
                        <ProtectedRoute allowedRoles={['customer']}>
                            <NotificationsPage />
                        </ProtectedRoute>
                    } />
                    <Route path="/customer/kyc" element={
                        <ProtectedRoute allowedRoles={['customer']}>
                            <KYCPage />
                        </ProtectedRoute>
                    } />
                    <Route path="/customer/contact" element={
                        <ProtectedRoute allowedRoles={['customer']}>
                            <ContactPage />
                        </ProtectedRoute>
                    } />
                    <Route path="/customer/history" element={
                        <ProtectedRoute allowedRoles={['customer']}>
                            <TransferHistoryPage />
                        </ProtectedRoute>
                    } />
                    <Route path="/customer/chatbot" element={
                        <ProtectedRoute allowedRoles={['customer']}>
                            <AiChatbotPage />
                        </ProtectedRoute>
                    } />
                    <Route path="/customer/support" element={
                        <ProtectedRoute allowedRoles={['customer']}>
                            <CustomerSupportPage />
                        </ProtectedRoute>
                    } />
                </Route>

                {/* ── Employee Area ── */}
                <Route element={<EmployeeLayout />}>
                    <Route path="/employee/portal" element={
                        <ProtectedRoute allowedRoles={['employee']}>
                            <EmployeePortalPage />
                        </ProtectedRoute>
                    } />
                    <Route path="/employee/customers" element={
                        <ProtectedRoute allowedRoles={['employee']}>
                            <EmployeePortalPage />
                        </ProtectedRoute>
                    } />
                    <Route path="/employee/accounts" element={
                        <ProtectedRoute allowedRoles={['employee']}>
                            <AccountsPage />
                        </ProtectedRoute>
                    } />
                    <Route path="/employee/transfer" element={
                        <ProtectedRoute allowedRoles={['employee']}>
                            <TransferPage />
                        </ProtectedRoute>
                    } />
                    <Route path="/employee/ledger" element={
                        <ProtectedRoute allowedRoles={['employee']}>
                            <LedgerPage />
                        </ProtectedRoute>
                    } />
                    <Route path="/employee/messages" element={
                        <ProtectedRoute allowedRoles={['employee']}>
                            <MessagesPage userRole="employee" />
                        </ProtectedRoute>
                    } />
                    <Route path="/employee/panel" element={
                        <ProtectedRoute allowedRoles={['employee']}>
                            <EmployeePanelPage />
                        </ProtectedRoute>
                    } />
                </Route>

                {/* ── CEO / Executive Area ── */}
                <Route element={<ExecutiveLayout />}>
                    <Route path="/executive/cockpit" element={
                        <ProtectedRoute allowedRoles={['ceo']}>
                            <ExecutiveCockpitPage />
                        </ProtectedRoute>
                    } />
                    <Route path="/executive/reports" element={
                        <ProtectedRoute allowedRoles={['ceo']}>
                            <CEOReportsPage />
                        </ProtectedRoute>
                    } />
                    <Route path="/executive/audit" element={
                        <ProtectedRoute allowedRoles={['ceo']}>
                            <AuditPage />
                        </ProtectedRoute>
                    } />
                    <Route path="/executive/messages" element={
                        <ProtectedRoute allowedRoles={['ceo']}>
                            <MessagesPage userRole="ceo" />
                        </ProtectedRoute>
                    } />
                </Route>

                {/* ── Admin Area ── */}
                <Route element={<AdminLayout />}>
                    <Route path="/admin/dashboard" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <DashboardPage />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/customers" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <EmployeePortalPage />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/accounts" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <AccountsPage />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/transfer" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <TransferPage />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/ledger" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <LedgerPage />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/audit" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <AuditPage />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/messages" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <MessagesPage userRole="admin" />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/panel" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <AdminPanelPage />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/spending" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <SpendingAnalysisPage />
                        </ProtectedRoute>
                    } />
                </Route>

                {/* 404 Fallback */}
                <Route path="*" element={<NotFoundPage />} />
            </Routes>

            {/* Global Chatbot Widget (visible when logged in) */}
            {isAuthenticated && <ChatbotWidget />}
        </div>
    );
}
