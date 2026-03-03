import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, RefreshCw } from "lucide-react";
import { chatbotApi } from "../../services/api";
import { toast } from "react-hot-toast";

export default function AiChatbotPage() {
    const [messages, setMessages] = useState([
        { role: "assistant", content: "Merhaba! 👋 Ben FinBank yapay zeka asistanıyım. Size nasıl yardımcı olabilirim?" }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const chatEndRef = useRef(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMessage = input.trim();
        setInput("");
        setMessages(prev => [...prev, { role: "user", content: userMessage }]);
        setLoading(true);

        try {
            const res = await chatbotApi.send({ message: userMessage });
            setMessages(prev => [...prev, { role: "assistant", content: res.data.reply || res.data.response || "Yanıt alınamadı." }]);
        } catch (error) {
            setMessages(prev => [...prev, { role: "assistant", content: "Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin." }]);
        } finally {
            setLoading(false);
        }
    };

    const quickQuestions = [
        "Hesap bakiyemi öğrenmek istiyorum",
        "Kredi kartı başvurusu nasıl yapılır?",
        "Transfer limitlerim nedir?",
        "Döviz kurları hakkında bilgi ver",
    ];

    return (
        <div style={{ maxWidth: 800, margin: "0 auto", padding: 24, display: "flex", flexDirection: "column", height: "calc(100vh - 120px)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Sparkles size={24} color="white" />
                </div>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>FinBank AI Asistan</h1>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Gemini AI ile desteklenmektedir</p>
                </div>
            </div>

            {/* Quick Questions */}
            {messages.length <= 1 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                    {quickQuestions.map((q, i) => (
                        <button
                            key={i}
                            onClick={() => { setInput(q); }}
                            style={{
                                padding: "8px 16px", borderRadius: 20, border: "1px solid var(--border-color)",
                                background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13,
                                cursor: "pointer", transition: "all 0.2s",
                            }}
                        >
                            {q}
                        </button>
                    ))}
                </div>
            )}

            {/* Chat Messages */}
            <div style={{
                flex: 1, overflowY: "auto", borderRadius: 16,
                background: "var(--bg-secondary)", border: "1px solid var(--border-color)",
                padding: 16, display: "flex", flexDirection: "column", gap: 12,
            }}>
                {messages.map((msg, i) => (
                    <div key={i} style={{
                        display: "flex", gap: 10,
                        flexDirection: msg.role === "user" ? "row-reverse" : "row",
                        alignItems: "flex-start",
                    }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                            background: msg.role === "user" ? "#ef4444" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                            {msg.role === "user" ? <User size={16} color="white" /> : <Bot size={16} color="white" />}
                        </div>
                        <div style={{
                            maxWidth: "75%", padding: "12px 16px", borderRadius: 16,
                            background: msg.role === "user" ? "#ef4444" : "var(--bg-card)",
                            color: msg.role === "user" ? "white" : "var(--text-primary)",
                            fontSize: 14, lineHeight: 1.6,
                            borderTopRightRadius: msg.role === "user" ? 4 : 16,
                            borderTopLeftRadius: msg.role === "user" ? 16 : 4,
                        }}>
                            {msg.content}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: "50%",
                            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                            <Bot size={16} color="white" />
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                            <span className="typing-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--text-secondary)", animation: "pulse 1s infinite" }}></span>
                            <span className="typing-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--text-secondary)", animation: "pulse 1s infinite 0.2s" }}></span>
                            <span className="typing-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--text-secondary)", animation: "pulse 1s infinite 0.4s" }}></span>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSend} style={{
                display: "flex", gap: 8, marginTop: 16, alignItems: "center",
            }}>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Mesajınızı yazın..."
                    disabled={loading}
                    style={{
                        flex: 1, padding: "14px 20px", borderRadius: 16,
                        border: "1px solid var(--border-color)", background: "var(--bg-card)",
                        color: "var(--text-primary)", fontSize: 14, outline: "none",
                    }}
                />
                <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    style={{
                        width: 48, height: 48, borderRadius: 16, border: "none",
                        background: "linear-gradient(135deg, #ef4444, #dc2626)",
                        color: "white", cursor: "pointer", display: "flex",
                        alignItems: "center", justifyContent: "center",
                        opacity: loading || !input.trim() ? 0.5 : 1,
                    }}
                >
                    <Send size={20} />
                </button>
            </form>
        </div>
    );
}
