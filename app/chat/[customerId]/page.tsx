"use client";

import { use, useEffect, useMemo, useState } from "react";
import { MessageSquare, Lock, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { WorldWideLoader } from "@/components/world-wide-loader";
import { parseJsonArray, coerceTimestamp, parseQatarDateTime } from "@/lib/outreach-types";

type ChatMsg = {
    type: "user" | "bot";
    content: string;
    label: string;
    date: string | null;
};

function sentimentStyle(raw: string): { background: string; color: string } {
    const s = String(raw).toLowerCase();
    if (s.includes("hot") || s.includes("positive") || s.includes("warm") || s.includes("interest"))
        return { background: "rgba(34,197,94,0.12)", color: "#16a34a" };
    if (s.includes("cold") || s.includes("negative") || s.includes("angry") || s.includes("frustrat"))
        return { background: "rgba(239,68,68,0.10)", color: "#dc2626" };
    if (s.includes("neutral"))
        return { background: "rgba(10,132,255,0.10)", color: "#0A84FF" };
    return { background: "rgba(148,163,184,0.14)", color: "#64748b" };
}

function buildTimeline(lead: any): ChatMsg[] {
    const timeline: ChatMsg[] = [];
    const conv = parseJsonArray(lead?.whatsapp_conversation ?? lead?.raw?.whatsapp_conversation);

    if (conv.length > 0) {
        conv.forEach((msg: any) => {
            const role = msg?.role || msg?.type || msg?.sender || "";
            const isUser = role === "user" || role === "User" || role === "customer";
            const content = msg.message || msg.content || msg.text || "";
            const date = coerceTimestamp(msg.date || msg.timestamp || msg.created_at || msg.sent_at)
                || parseQatarDateTime(msg.qatar_timestamp);
            const agentLabel = msg.agent || (isUser ? "customer" : "bot");
            const label = isUser ? "User" : (agentLabel === "b2b_ai" ? "AI Agent" : "Bot");
            if (content && String(content).trim()) {
                timeline.push({ type: isUser ? "user" : "bot", content: String(content).trim(), label, date });
            }
        });
        timeline.sort((a, b) => (a.date ? new Date(a.date).getTime() : 0) - (b.date ? new Date(b.date).getTime() : 0));
        return timeline;
    }

    // Fallback: build from wa_1..wa_4 columns.
    const raw = lead?.raw ?? lead;
    for (let n = 1; n <= 4; n++) {
        const text = raw?.[`wa_${n}`];
        if (!text || !String(text).trim()) continue;
        timeline.push({ type: "bot", content: String(text).trim(), label: `WhatsApp ${n}`, date: coerceTimestamp(raw?.[`wa_${n}_sent_at`]) });
    }
    if (raw?.last_whatsapp_message && raw?.whatsapp_replied) {
        timeline.push({ type: "user", content: String(raw.last_whatsapp_message).trim(), label: "User", date: coerceTimestamp(raw.last_activity) });
    }
    return timeline;
}

export default function PublicChatPage({ params }: { params: Promise<{ customerId: string }> }) {
    const { customerId } = use(params);
    const decodedId = decodeURIComponent(customerId);

    const [lead, setLead] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/public/chat/${encodeURIComponent(decodedId)}`);
                if (!res.ok) { setError(res.status === 404 ? "Chat not found" : "Failed to load chat"); return; }
                const json = await res.json();
                setLead(json.lead || null);
            } catch {
                setError("An error occurred");
            } finally {
                setLoading(false);
            }
        })();
    }, [decodedId]);

    const messages = useMemo(() => (lead ? buildTimeline(lead) : []), [lead]);
    const waSentiment: string | null = lead ? (lead.wa_sentiment ?? lead.raw?.wa_sentiment ?? null) : null;
    const waNote: string | null = lead ? (lead.wa_note ?? lead.raw?.wa_note ?? null) : null;
    const name = lead ? (lead.name || lead.full_name || "Lead") : "";
    const phone = lead ? (lead.phone || "") : "";

    if (loading) {
        return (
            <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9" }}>
                <WorldWideLoader />
            </div>
        );
    }

    if (error || !lead) {
        return (
            <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "#f1f5f9", color: "#64748b" }}>
                <MessageSquare style={{ width: 40, height: 40, opacity: 0.3 }} />
                <p style={{ fontWeight: 600, color: "#475569" }}>{error || "Chat not found"}</p>
                <p style={{ fontSize: 12, color: "#94a3b8" }}>If you believe this is an error, please contact support.</p>
            </div>
        );
    }

    return (
        <div style={{ minHeight: "100vh", background: "#f1f5f9", display: "flex", flexDirection: "column" }}>
            <div style={{ background: "#0f172a", color: "#fff", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 12, fontWeight: 500 }}>
                <Lock style={{ width: 12, height: 12, color: "#34d399" }} />
                <span>Secure Chat Viewer • Public access restricted to this chat only</span>
            </div>

            <div style={{ flex: 1, width: "100%", maxWidth: 760, margin: "0 auto", padding: "24px 16px" }}>
                <div style={{ background: "#fff", borderRadius: 20, boxShadow: "0 1px 3px rgba(15,23,42,0.06), 0 8px 28px rgba(15,23,42,0.07)", overflow: "hidden" }}>
                    <div style={{ padding: "18px 22px", borderBottom: "1px solid #e2e8f0" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                            <h1 style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", margin: 0 }}>{name}</h1>
                            {waSentiment && (
                                <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700, textTransform: "capitalize", ...sentimentStyle(waSentiment) }}>
                                    {waSentiment}
                                </span>
                            )}
                        </div>
                        <p style={{ fontSize: 12, color: "#64748b", margin: "3px 0 0" }}>
                            {phone || ""}
                            {` · ${messages.length} message${messages.length === 1 ? "" : "s"}`}
                        </p>
                        {waNote && (
                            <div style={{ marginTop: 10, padding: "8px 11px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                                <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", margin: "0 0 3px" }}>AI Note</p>
                                {String(waNote).split("|").map((part, i) => {
                                    const t = part.trim();
                                    if (!t) return null;
                                    return <p key={i} style={{ fontSize: 12.5, lineHeight: 1.55, color: "#334155", margin: 0, whiteSpace: "pre-wrap" }}>{t}</p>;
                                })}
                            </div>
                        )}
                    </div>

                    <div style={{ padding: "8px 22px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
                        {messages.length === 0 && (
                            <div style={{ padding: "40px 0", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No messages in this conversation.</div>
                        )}
                        {messages.map((msg, i) => {
                            const isUser = msg.type === "user";
                            return (
                                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-start" : "flex-end", width: "100%", marginTop: 12 }}>
                                    <div style={{
                                        maxWidth: "88%", padding: "10px 13px", borderRadius: 12,
                                        background: isUser ? "rgba(34,197,94,0.09)" : "#f1f5f9",
                                        border: `1px solid ${isUser ? "rgba(34,197,94,0.20)" : "#e2e8f0"}`,
                                        borderTopLeftRadius: isUser ? 3 : 12,
                                        borderTopRightRadius: isUser ? 12 : 3,
                                    }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                                            {isUser ? <ArrowDownLeft style={{ width: 11, height: 11, color: "#16a34a" }} /> : <ArrowUpRight style={{ width: 11, height: 11, color: "#0A84FF" }} />}
                                            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: isUser ? "#16a34a" : "#0A84FF" }}>
                                                {msg.label}
                                            </span>
                                            {msg.date && <span style={{ fontSize: 10, color: "#94a3b8" }}>· {(() => { try { return new Date(msg.date).toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }); } catch { return ""; } })()}</span>}
                                        </div>
                                        <p style={{ fontSize: 13, lineHeight: 1.55, color: "#0f172a", margin: 0, whiteSpace: "pre-wrap" }}>{msg.content}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
