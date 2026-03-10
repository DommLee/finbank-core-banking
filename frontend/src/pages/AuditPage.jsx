import { useState, useEffect } from "react";
import { auditApi } from "../services/api";
import { Shield, ChevronLeft, ChevronRight, Filter } from "lucide-react";

export default function AuditPage() {
    const [logs, setLogs] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [skip, setSkip] = useState(0);
    const [actionFilter, setActionFilter] = useState("");
    const [outcomeFilter, setOutcomeFilter] = useState("");
    const limit = 20;

    useEffect(() => {
        loadLogs();
    }, [skip, actionFilter, outcomeFilter]);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const params = { skip, limit };
            if (actionFilter) params.action = actionFilter;
            if (outcomeFilter) params.outcome = outcomeFilter;
            const res = await auditApi.getLogs(params);
            setLogs(res.data.logs);
            setTotal(res.data.total);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const actionLabels = {
        LOGIN_SUCCESS: "Giriş Başarılı",
        LOGIN_FAILED: "Giriş Başarısız",
        REGISTER: "Kayıt",
        CUSTOMER_CREATED: "Müşteri Oluşturma",
        CUSTOMER_UPDATED: "Müşteri Güncelleme",
        ACCOUNT_CREATED: "Hesap Açma",
        DEPOSIT_EXECUTED: "Para Yatırma",
        WITHDRAWAL_EXECUTED: "Para Çekme",
        TRANSFER_EXECUTED: "Transfer",
        TRANSFER_FAILED: "Transfer Başarısız",
        KYC_STATUS_UPDATED: "KYC Güncelleme",
    };

    return (
        <div>
            <div className="page-header">
                <h1>🛡️ Denetim Kayıtları</h1>
                <p>Tüm sistem eylemlerinin güvenlik izi — Toplam {total} kayıt</p>
            </div>

            {/* Filters */}
            <div className="card" style={{ marginBottom: 16, padding: 16 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <Filter size={16} style={{ color: "var(--text-secondary)" }} />
                    <select
                        className="form-select"
                        style={{ width: 200 }}
                        value={actionFilter}
                        onChange={(e) => { setActionFilter(e.target.value); setSkip(0); }}
                    >
                        <option value="">Tüm Eylemler</option>
                        {Object.entries(actionLabels).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </select>
                    <select
                        className="form-select"
                        style={{ width: 150 }}
                        value={outcomeFilter}
                        onChange={(e) => { setOutcomeFilter(e.target.value); setSkip(0); }}
                    >
                        <option value="">Tüm Sonuçlar</option>
                        <option value="SUCCESS">Başarılı</option>
                        <option value="FAILURE">Başarısız</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="loading-container"><div className="spinner" /></div>
            ) : logs.length === 0 ? (
                <div className="empty-state">
                    <Shield size={48} style={{ opacity: 0.3 }} />
                    <p style={{ marginTop: 12 }}>Denetim kaydı bulunamadı.</p>
                </div>
            ) : (
                <>
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Zaman</th>
                                    <th>Kullanıcı</th>
                                    <th>Rol</th>
                                    <th>Eylem</th>
                                    <th>Sonuç</th>
                                    <th>Detay</th>
                                    <th>IP Adresi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log) => (
                                    <tr key={log.id}>
                                        <td style={{ fontSize: 13, whiteSpace: "nowrap" }}>
                                            {new Date(log.timestamp).toLocaleString("tr-TR", {
                                                day: "2-digit", month: "2-digit", year: "numeric",
                                                hour: "2-digit", minute: "2-digit", second: "2-digit",
                                            })}
                                        </td>
                                        <td style={{ fontSize: 13 }}>{log.user_email || "—"}</td>
                                        <td>
                                            <span className={`badge ${log.role === "admin" ? "badge-danger" : "badge-info"}`}>
                                                {log.role === "admin" ? "Yönetici" : log.role || "—"}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="badge badge-neutral">
                                                {actionLabels[log.action] || log.action}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`badge ${log.outcome === "SUCCESS" ? "badge-success" : "badge-danger"}`}>
                                                {log.outcome === "SUCCESS" ? "Başarılı" : "Başarısız"}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: 12, maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis" }}>
                                            {log.details || "—"}
                                        </td>
                                        <td style={{ fontFamily: "monospace", fontSize: 12 }}>{log.ip_address || "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="pagination">
                        <button
                            className="btn btn-outline btn-sm"
                            onClick={() => setSkip(Math.max(0, skip - limit))}
                            disabled={skip === 0}
                        >
                            <ChevronLeft size={14} /> Önceki
                        </button>
                        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                            {skip + 1} - {Math.min(skip + limit, total)} / {total}
                        </span>
                        <button
                            className="btn btn-outline btn-sm"
                            onClick={() => setSkip(skip + limit)}
                            disabled={skip + limit >= total}
                        >
                            Sonraki <ChevronRight size={14} />
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
