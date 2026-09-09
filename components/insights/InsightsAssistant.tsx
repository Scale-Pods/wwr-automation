"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Send, Loader2, RefreshCw } from "lucide-react";

interface Msg {
    role: "user" | "assistant";
    content: string;
    error?: boolean;
}

const SUGGESTIONS = [
    "Give me a full overview of everything",
    "How many WhatsApp messages were sent, and how many replied?",
    "Any positive replies on emails this month?",
    "How many people picked up the call?",
];

const WELCOME =
    "Hi! I'm your Personal Insights Assistant. Ask me anything about your leads, WhatsApp, email, or voice-call performance and I'll pull it straight from the database.";

function getSessionId(): string {
    if (typeof window === "undefined") return "server";
    try {
        let id = localStorage.getItem("insights_session_id");
        if (!id) {
            id =
                "sess_" +
                Date.now().toString(36) +
                Math.random().toString(36).slice(2, 8);
            localStorage.setItem("insights_session_id", id);
        }
        return id;
    } catch {
        return "anon_" + Math.random().toString(36).slice(2, 10);
    }
}

export function InsightsAssistant() {
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState<Msg[]>([
        { role: "assistant", content: WELCOME },
    ]);
    const sessionRef = useRef<string>("");
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        sessionRef.current = getSessionId();
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 150);
    }, [open]);

    async function send(text?: string) {
        const q = (text ?? input).trim();
        if (!q || loading) return;

        setInput("");
        setMessages((m) => [...m, { role: "user", content: q }]);
        setLoading(true);

        try {
            const res = await fetch("/api/insights-chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: q, sessionId: sessionRef.current }),
            });
            const data = await res.json();
            if (!res.ok) {
                setMessages((m) => [
                    ...m,
                    {
                        role: "assistant",
                        content:
                            data.error ||
                            "Something went wrong reaching the assistant.",
                        error: true,
                    },
                ]);
            } else {
                setMessages((m) => [
                    ...m,
                    { role: "assistant", content: data.reply },
                ]);
            }
        } catch {
            setMessages((m) => [
                ...m,
                {
                    role: "assistant",
                    content: "Network error — please try again.",
                    error: true,
                },
            ]);
        } finally {
            setLoading(false);
        }
    }

    function reset() {
        setMessages([{ role: "assistant", content: WELCOME }]);
        try {
            const id =
                "sess_" +
                Date.now().toString(36) +
                Math.random().toString(36).slice(2, 8);
            localStorage.setItem("insights_session_id", id);
            sessionRef.current = id;
        } catch {
            /* ignore */
        }
    }

    return (
        <>
            {/* Launcher */}
            {!open && (
                <button
                    onClick={() => setOpen(true)}
                    aria-label="Open Insights Assistant"
                    style={{
                        position: "fixed",
                        bottom: 24,
                        right: 24,
                        zIndex: 60,
                        width: 56,
                        height: 56,
                        borderRadius: 18,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "var(--blue)",
                        color: "#fff",
                        border: "1px solid rgba(255,255,255,0.18)",
                        boxShadow:
                            "0 12px 32px rgba(10,132,255,0.35), 0 2px 8px rgba(0,0,0,0.25)",
                        cursor: "pointer",
                        transition: "transform 0.2s ease, box-shadow 0.2s ease",
                    }}
                    className="hover:scale-105 active:scale-95"
                >
                    <Sparkles size={24} />
                </button>
            )}

            {/* Panel */}
            {open && (
                <div
                    style={{
                        position: "fixed",
                        bottom: 24,
                        right: 24,
                        zIndex: 60,
                        width: "min(420px, calc(100vw - 32px))",
                        height: "min(640px, calc(100vh - 48px))",
                        display: "flex",
                        flexDirection: "column",
                        borderRadius: 20,
                        overflow: "hidden",
                        background: "var(--bg-layer2)",
                        backdropFilter: "blur(35px) saturate(190%)",
                        border: "1px solid var(--glass-border)",
                        boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
                    }}
                >
                    {/* Header */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "14px 16px",
                            borderBottom: "1px solid var(--hairline)",
                            background: "var(--bg-layer1)",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 10,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    background: "rgba(10,132,255,0.14)",
                                    color: "var(--blue)",
                                }}
                            >
                                <Sparkles size={17} />
                            </div>
                            <div>
                                <div
                                    style={{
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: "var(--label-primary)",
                                        letterSpacing: "-0.01em",
                                    }}
                                >
                                    Insights Assistant
                                </div>
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: "var(--label-tertiary)",
                                    }}
                                >
                                    Ask anything about your data
                                </div>
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                            <button
                                onClick={reset}
                                title="New conversation"
                                style={iconBtn}
                                className="hover:bg-[var(--fill-tertiary)]"
                            >
                                <RefreshCw size={15} />
                            </button>
                            <button
                                onClick={() => setOpen(false)}
                                title="Close"
                                style={iconBtn}
                                className="hover:bg-[var(--fill-tertiary)]"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div
                        ref={scrollRef}
                        className="custom-scrollbar"
                        style={{
                            flex: 1,
                            overflowY: "auto",
                            padding: 16,
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                        }}
                    >
                        {messages.map((m, i) => (
                            <div
                                key={i}
                                style={{
                                    alignSelf:
                                        m.role === "user" ? "flex-end" : "flex-start",
                                    maxWidth: "85%",
                                    padding: "10px 13px",
                                    borderRadius: 14,
                                    fontSize: 13,
                                    lineHeight: 1.55,
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-word",
                                    background:
                                        m.role === "user"
                                            ? "var(--blue)"
                                            : m.error
                                              ? "rgba(220,38,38,0.12)"
                                              : "var(--fill-secondary)",
                                    color:
                                        m.role === "user"
                                            ? "#fff"
                                            : m.error
                                              ? "#f87171"
                                              : "var(--label-primary)",
                                    border:
                                        m.role === "assistant" && !m.error
                                            ? "1px solid var(--glass-border)"
                                            : "none",
                                }}
                            >
                                {m.content}
                            </div>
                        ))}

                        {loading && (
                            <div
                                style={{
                                    alignSelf: "flex-start",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: "10px 13px",
                                    borderRadius: 14,
                                    fontSize: 13,
                                    background: "var(--fill-secondary)",
                                    color: "var(--label-secondary)",
                                    border: "1px solid var(--glass-border)",
                                }}
                            >
                                <Loader2 size={14} className="animate-spin" />
                                Digging through the data…
                            </div>
                        )}

                        {messages.length === 1 && !loading && (
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 6,
                                    marginTop: 4,
                                }}
                            >
                                {SUGGESTIONS.map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => send(s)}
                                        style={{
                                            textAlign: "left",
                                            padding: "9px 12px",
                                            borderRadius: 11,
                                            fontSize: 12.5,
                                            color: "var(--label-secondary)",
                                            background: "var(--fill-tertiary)",
                                            border: "1px solid var(--glass-border)",
                                            cursor: "pointer",
                                            transition: "all 0.15s ease",
                                        }}
                                        className="hover:text-[var(--label-primary)] hover:bg-[var(--fill-secondary)]"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Composer */}
                    <div
                        style={{
                            padding: 12,
                            borderTop: "1px solid var(--hairline)",
                            background: "var(--bg-layer1)",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "flex-end",
                                gap: 8,
                                background: "var(--fill-secondary)",
                                border: "1px solid var(--glass-border)",
                                borderRadius: 14,
                                padding: "6px 6px 6px 12px",
                            }}
                        >
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        send();
                                    }
                                }}
                                rows={1}
                                placeholder="Ask about leads, WhatsApp, email, calls…"
                                style={{
                                    flex: 1,
                                    resize: "none",
                                    maxHeight: 120,
                                    background: "transparent",
                                    border: "none",
                                    outline: "none",
                                    color: "var(--label-primary)",
                                    fontSize: 13,
                                    lineHeight: 1.5,
                                    padding: "5px 0",
                                    fontFamily: "inherit",
                                }}
                            />
                            <button
                                onClick={() => send()}
                                disabled={!input.trim() || loading}
                                style={{
                                    width: 34,
                                    height: 34,
                                    flexShrink: 0,
                                    borderRadius: 10,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    background:
                                        input.trim() && !loading
                                            ? "var(--blue)"
                                            : "var(--fill-tertiary)",
                                    color:
                                        input.trim() && !loading
                                            ? "#fff"
                                            : "var(--label-tertiary)",
                                    border: "none",
                                    cursor:
                                        input.trim() && !loading
                                            ? "pointer"
                                            : "default",
                                    transition: "all 0.15s ease",
                                }}
                            >
                                {loading ? (
                                    <Loader2 size={15} className="animate-spin" />
                                ) : (
                                    <Send size={15} />
                                )}
                            </button>
                        </div>
                        <div
                            style={{
                                fontSize: 10,
                                color: "var(--label-tertiary)",
                                textAlign: "center",
                                marginTop: 6,
                            }}
                        >
                            Answers are generated from live database queries.
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

const iconBtn: React.CSSProperties = {
    width: 30,
    height: 30,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: "none",
    color: "var(--label-secondary)",
    cursor: "pointer",
    transition: "all 0.15s ease",
};
