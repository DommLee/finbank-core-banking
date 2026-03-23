import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";

const WebSocketContext = createContext(null);

const WS_RECONNECT_DELAY = 3000;
const WS_PING_INTERVAL = 30000;

/**
 * WebSocket Provider — Gerçek zamanlı bildirim yönetimi
 * Login olunca bağlantı açılır, logout olunca kapanır.
 * Transfer bildirimleri toast olarak gösterilir.
 */
export function WebSocketProvider({ children }) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const wsRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const shouldReconnectRef = useRef(false);

  // Toast bildirimlerini yönet
  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random();
    const newToast = { id, ...toast, createdAt: new Date() };
    setNotifications((prev) => [newToast, ...prev].slice(0, 10));

    // 6 saniye sonra otomatik kaldır
    setTimeout(() => {
      setNotifications((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  // WebSocket bağlantısını kapat
  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // WebSocket bağlantısını aç
  const connect = useCallback(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    // Mevcut bağlantıyı kapat
    if (wsRef.current) {
      wsRef.current.close();
    }

    // WS URL'ini oluştur
    const envApiUrl = (import.meta.env.VITE_API_URL || "").trim();
    const isLocalRuntime =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const apiUrl = (isLocalRuntime ? "/api/v1" : (envApiUrl || "/api/v1")).replace(/\/$/, "");
    let wsUrl;
    const encodedToken = encodeURIComponent(token);

    if (apiUrl.startsWith("http")) {
      // Tam URL verilmişse: https://... → wss://...
      wsUrl = apiUrl
        .replace(/^https/, "wss")
        .replace(/^http/, "ws")
        .replace(/\/api\/v1$/, "") + `/api/v1/ws?token=${encodedToken}`;
    } else {
      // Relative path: window.location kullan
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      wsUrl = `${protocol}//${window.location.host}/api/v1/ws?token=${encodedToken}`;
    }

    shouldReconnectRef.current = true;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WS] ✅ Bağlantı kuruldu");
        setIsConnected(true);

        // Ping-pong ile bağlantıyı canlı tut
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, WS_PING_INTERVAL);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);

          // Mesaj tipine göre toast bildirimi göster
          switch (data.type) {
            case "transfer_sent":
              addToast({
                type: "success",
                title: data.title || "Transfer Gönderildi 💸",
                message: data.message,
                icon: "💸",
              });
              break;

            case "transfer_received":
              addToast({
                type: "success",
                title: data.title || "Para Alındı 🎉",
                message: data.message,
                icon: "🎉",
              });
              break;

            case "message_reply":
              addToast({
                type: "info",
                title: "Mesaj Yanıtı 💬",
                message: data.message,
                icon: "💬",
              });
              break;

            case "info":
            case "warning":
            case "error":
            case "success":
              addToast({
                type: data.type,
                title: data.title || "Bildirim",
                message: data.message,
                icon: data.type === "error" ? "❌" : data.type === "warning" ? "⚠️" : "ℹ️",
              });
              break;

            case "pong":
              // Ping-pong yanıtı, işlem yapmaya gerek yok
              break;

            default:
              console.log("[WS] Bilinmeyen mesaj tipi:", data.type);
          }
        } catch {
          // JSON parse hatası — plain text mesaj
          console.log("[WS] Plain mesaj:", event.data);
        }
      };

      ws.onclose = (event) => {
        console.log(`[WS] ❌ Bağlantı kapandı (code: ${event.code})`);
        setIsConnected(false);

        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Otomatik yeniden bağlanma
        if (shouldReconnectRef.current && event.code !== 1000) {
          console.log(`[WS] 🔄 ${WS_RECONNECT_DELAY / 1000}s sonra yeniden bağlanılacak...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, WS_RECONNECT_DELAY);
        }
      };

      ws.onerror = (error) => {
        console.error("[WS] Hata:", error);
      };
    } catch (error) {
      console.error("[WS] Bağlantı oluşturulamadı:", error);
    }
  }, [addToast]);

  // Component unmount olduğunda temizle
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Auth değişikliklerini dinle (login/logout)
  useEffect(() => {
    const handleAuthChange = (event) => {
      const { action } = event.detail || {};
      if (action === "login") {
        // Kısa bir gecikme ile bağlan (token localStorage'a yazılmasını bekle)
        setTimeout(() => connect(), 100);
      } else if (action === "logout") {
        disconnect();
      }
    };

    window.addEventListener("finbank-auth-change", handleAuthChange);

    // Sayfa yüklendiğinde token varsa otomatik bağlan
    const token = localStorage.getItem("token");
    if (token) {
      connect();
    }

    return () => {
      window.removeEventListener("finbank-auth-change", handleAuthChange);
    };
  }, [connect, disconnect]);

  const value = {
    isConnected,
    lastMessage,
    notifications,
    connect,
    disconnect,
    addToast,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
      {/* Toast Bildirimleri */}
      <ToastContainer notifications={notifications} />
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error("useWebSocket must be used within WebSocketProvider");
  return ctx;
}

// ══════════════════════════════════════════════════
// 🔔 Toast Notification Container
// ══════════════════════════════════════════════════
function ToastContainer({ notifications }) {
  if (notifications.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        right: 20,
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        maxWidth: 400,
        pointerEvents: "none",
      }}
    >
      {notifications.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

function ToastItem({ toast }) {
  const bgColors = {
    success: "linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(5, 150, 105, 0.95))",
    info: "linear-gradient(135deg, rgba(59, 130, 246, 0.95), rgba(37, 99, 235, 0.95))",
    warning: "linear-gradient(135deg, rgba(245, 158, 11, 0.95), rgba(217, 119, 6, 0.95))",
    error: "linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(220, 38, 38, 0.95))",
  };

  return (
    <div
      style={{
        background: bgColors[toast.type] || bgColors.info,
        color: "#fff",
        padding: "16px 20px",
        borderRadius: 16,
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)",
        backdropFilter: "blur(20px)",
        animation: "wsToastSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        pointerEvents: "auto",
        cursor: "pointer",
        transition: "transform 0.2s ease, opacity 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.02)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span style={{ fontSize: 24, lineHeight: 1 }}>{toast.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: "-0.01em",
              marginBottom: 4,
            }}
          >
            {toast.title}
          </div>
          <div
            style={{
              fontSize: 13,
              opacity: 0.9,
              lineHeight: 1.4,
              wordBreak: "break-word",
            }}
          >
            {toast.message}
          </div>
        </div>
      </div>
      <style>
        {`
          @keyframes wsToastSlideIn {
            from {
              transform: translateX(100%) scale(0.9);
              opacity: 0;
            }
            to {
              transform: translateX(0) scale(1);
              opacity: 1;
            }
          }
        `}
      </style>
    </div>
  );
}

export default WebSocketContext;
