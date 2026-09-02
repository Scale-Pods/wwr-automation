"use client";

import { useState, useEffect, useContext } from "react";
import { RefreshCw, MessageSquare, User, Bot, Link as LinkIcon, Check, Languages } from "lucide-react";
import { ConsolidatedLead } from "@/lib/leads-utils";
import { DataContext } from "@/context/DataContext";
import { parseJsonArray, coerceTimestamp } from "@/lib/outreach-types";

interface WhatsAppChatDetailProps {
    customerId: string;
    onClose?: () => void;
    initialLead?: ConsolidatedLead | any;
}

const EMPTY_LEADS: any[] = [];

export function WhatsAppChatDetail({ customerId, onClose, initialLead }: WhatsAppChatDetailProps) {
    const dataContext = (useContext(DataContext) || {}) as any;
    const { leads: allLeads = EMPTY_LEADS, loadingLeads = false } = dataContext;
    const [lead, setLead] = useState<any | null>(initialLead || null);
    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState<any[]>([]);
    const [copied, setCopied] = useState(false);
    const [isTranslated, setIsTranslated] = useState(false);
    const [isTranslating, setIsTranslating] = useState(false);
    const [translatedMessages, setTranslatedMessages] = useState<Record<number, string>>({});

    const handleTranslate = async () => {
        if (isTranslated) { setIsTranslated(false); return; }
        if (Object.keys(translatedMessages).length > 0) { setIsTranslated(true); return; }
        setIsTranslating(true);
        try {
            const response = await fetch("/api/translate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ texts: messages.map(m => m.content) }),
            });
            if (response.ok) {
                const data = await response.json();
                const translations = data.translatedTexts || [];
                const newTranslations: Record<number, string> = {};
                messages.forEach((m, i) => { if (translations[i]) newTranslations[i] = translations[i]; });
                setTranslatedMessages(newTranslations);
                setIsTranslated(true);
            }
        } catch (error) {
            console.error("Translation failed:", error);
        } finally {
            setIsTranslating(false);
        }
    };

    const handleCopyLink = () => {
        if (!lead) return;
        const shareUrl = `${window.location.origin}/chat/${encodeURIComponent(lead.id || lead.lead_id || lead.phone)}`;
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(shareUrl).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }).catch(console.error);
        } else {
            const ta = document.createElement("textarea");
            ta.value = shareUrl;
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand("copy"); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { }
            document.body.removeChild(ta);
        }
    };

    useEffect(() => {
        if (!initialLead && loadingLeads) { setLoading(true); return; }

        const searchVal = String(customerId).toLowerCase().trim();
        const found = initialLead || allLeads.find((l: any) => {
            if (String(l.id).toLowerCase() === searchVal) return true;
            if (String(l.crm_id || "").toLowerCase() === searchVal) return true;
            if (l.phone) {
                const lp = String(l.phone).replace(/\D/g, "");
                const sv = searchVal.replace(/\D/g, "");
                if (sv && lp === sv) return true;
            }
            return false;
        }) || null;

        if (found) {
            const rawName = found.name || found.full_name || [found.first_name, found.last_name].filter(Boolean).join(" ") || "";
            const isPhone = /^\+?\d[\d\s\-().]{4,}$/.test(String(rawName).trim());
            const normalized = {
                ...found,
                name: rawName && !isPhone ? rawName : "Unknown",
                phone: found.phone || "",
                email: found.email || "",
                stage: found.lead_stage || found.lead_status || "—",
            };
            setLead(normalized);

            const timeline: any[] = [];
            let seq = 1;

            const conv = parseJsonArray(found.whatsapp_conversation);
            if (conv.length > 0) {
                conv.forEach((msg: any) => {
                    const role = msg?.role || msg?.type || msg?.sender || "";
                    const isUser = role === "user" || role === "User" || role === "customer";
                    const content = msg.message || msg.content || msg.text || "";
                    const date = coerceTimestamp(msg.timestamp || msg.date || msg.created_at);
                    const agentLabel = msg.agent || (isUser ? "customer" : "bot");
                    const label = isUser ? "User" : (agentLabel === "b2b_ai" ? "AI Agent" : "Bot");
                    if (content && String(content).trim()) {
                        timeline.push({
                            type: isUser ? "user" : "bot",
                            content: String(content).trim(),
                            label,
                            date,
                            sequence: seq++,
                            tsStatus: msg.status || null,
                            intent: msg.intent || null,
                        });
                    }
                });
            }

            // Fallback: build from wa_1..wa_4 columns
            if (timeline.length === 0) {
                for (let n = 1; n <= 4; n++) {
                    const raw = found[`wa_${n}`];
                    if (!raw || !String(raw).trim()) continue;
                    timeline.push({
                        type: "bot",
                        content: String(raw).trim(),
                        label: `WhatsApp ${n}`,
                        date: coerceTimestamp(found[`wa_${n}_sent_at`]),
                        sequence: seq++,
                        tsStatus: found[`wa_${n}_status`] || null,
                        intent: null,
                    });
                }
                // If the lead replied but we have no per-message inbound, show a stub
                if (found.last_whatsapp_message && found.whatsapp_replied) {
                    timeline.push({
                        type: "user",
                        content: String(found.last_whatsapp_message).trim(),
                        label: "User",
                        date: coerceTimestamp(found.last_activity),
                        sequence: seq++,
                        tsStatus: null,
                        intent: null,
                    });
                }
            }

            setMessages(timeline);
        } else {
            setLead(null);
            setMessages([]);
        }
        setLoading(false);
    }, [customerId, allLeads, loadingLeads, initialLead]);

    if (loading) {
        return (
            <div style={{ height: 440, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "var(--label-tertiary)" }}>
                <RefreshCw style={{ width: 20, height: 20, color: "var(--green)" }} className="animate-spin" />
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--label-secondary)", margin: 0 }}>Syncing Chat History…</p>
            </div>
        );
    }

    if (!lead) {
        return (
            <div style={{ height: 440, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--label-tertiary)" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--fill-tertiary)", border: "1px solid var(--glass-border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <MessageSquare style={{ width: 18, height: 18, opacity: 0.4 }} />
                </div>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--label-secondary)", margin: 0 }}>Lead Not Found</p>
                {onClose && (
                    <button onClick={onClose} style={{ marginTop: 4, padding: "6px 14px", borderRadius: 8, background: "var(--fill-tertiary)", border: "1px solid var(--glass-border)", color: "var(--label-primary)", fontSize: 12, cursor: "pointer" }}>Close</button>
                )}
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", maxHeight: "80vh", background: "var(--bg-layer1)", borderRadius: 14, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexShrink: 0 }}>
                <div>
                    <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--label-primary)", letterSpacing: "-0.01em", margin: 0 }}>{lead.name}</h2>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, fontSize: 12, color: "var(--label-secondary)" }}>
                        <span style={{ fontFamily: "ui-monospace, monospace" }}>{lead.phone}</span>
                        <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--label-quaternary)", display: "inline-block" }} />
                        <span style={{ textTransform: "capitalize" }}>{lead.stage}</span>
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button disabled={isTranslating} onClick={handleTranslate}
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: isTranslating ? "not-allowed" : "pointer", background: isTranslated ? "rgba(10,132,255,0.10)" : "var(--fill-tertiary)", border: `1px solid ${isTranslated ? "rgba(10,132,255,0.25)" : "var(--glass-border)"}`, color: isTranslated ? "var(--blue)" : "var(--label-primary)" }}>
                        {isTranslating ? <RefreshCw style={{ width: 12, height: 12 }} className="animate-spin" /> : <Languages style={{ width: 12, height: 12 }} />}
                        {isTranslated ? "Original" : "Translate"}
                    </button>
                    <button onClick={handleCopyLink}
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", background: copied ? "rgba(48,209,88,0.15)" : "var(--blue)", border: `1px solid ${copied ? "rgba(48,209,88,0.30)" : "transparent"}`, color: copied ? "var(--green)" : "#fff" }}>
                        {copied ? <Check style={{ width: 12, height: 12 }} /> : <LinkIcon style={{ width: 12, height: 12 }} />}
                        {copied ? "Copied" : "Share Link"}
                    </button>
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 196px", gap: 12, flex: 1, overflow: "hidden", minHeight: 0 }}>
                <div style={{ display: "flex", flexDirection: "column", background: "var(--fill-quaternary)", border: "1px solid var(--hairline)", borderRadius: 10, overflow: "hidden", height: "100%", minHeight: 0 }}>
                    <div style={{ borderBottom: "1px solid var(--hairline)", padding: "9px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--label-tertiary)", display: "flex", alignItems: "center", gap: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                            <MessageSquare style={{ width: 12, height: 12 }} /> Conversation
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "var(--fill-secondary)", color: "var(--label-secondary)", border: "1px solid var(--hairline)" }}>{messages.length} msg</span>
                    </div>

                    <div className="custom-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                        {messages.length === 0 ? (
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--label-tertiary)", gap: 8 }}>
                                <MessageSquare style={{ width: 20, height: 20, opacity: 0.2 }} />
                                <p style={{ fontSize: 12, fontWeight: 500, margin: 0 }}>No Messages Found</p>
                            </div>
                        ) : (
                            messages.map((msg, idx) => {
                                let tsPill = null;
                                const rawStatus = msg.tsStatus;
                                if (rawStatus) {
                                    const statusStr = String(rawStatus).trim();
                                    const formatted = statusStr.charAt(0).toUpperCase() + statusStr.slice(1).toLowerCase();
                                    let pillBg = "var(--fill-secondary)";
                                    let pillColor = "var(--label-tertiary)";
                                    if (formatted.includes("Read")) { pillBg = "rgba(10,132,255,0.10)"; pillColor = "var(--blue)"; }
                                    if (formatted.includes("Fail")) { pillBg = "rgba(255,69,58,0.10)"; pillColor = "var(--red)"; }
                                    if (formatted.includes("Sent") || formatted.includes("Deliver")) { pillBg = "rgba(48,209,88,0.10)"; pillColor = "var(--green)"; }
                                    tsPill = <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 5, background: pillBg, color: pillColor }}>{formatted}</span>;
                                }

                                const isUser = msg.type === "user";
                                const intent = msg.intent;
                                return (
                                    <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-start" : "flex-end", width: "100%" }}>
                                        <div style={{ maxWidth: "85%", padding: "8px 11px", background: isUser ? "rgba(48,209,88,0.09)" : "var(--fill-tertiary)", border: `1px solid ${isUser ? "rgba(48,209,88,0.18)" : "var(--hairline)"}`, borderRadius: 10, borderTopLeftRadius: isUser ? 3 : 10, borderTopRightRadius: isUser ? 10 : 3 }}>
                                            <div style={{ marginBottom: 3, display: "flex", alignItems: "center", gap: 6 }}>
                                                <span style={{ fontSize: 10, fontWeight: 600, color: isUser ? "var(--green)" : "var(--blue)" }}>{msg.label}</span>
                                                {!isUser && intent && (
                                                    <span style={{ fontSize: 9, fontWeight: 500, padding: "1px 5px", borderRadius: 4, background: "rgba(175,82,222,0.10)", color: "var(--purple)" }}>
                                                        {String(intent).length > 30 ? String(intent).substring(0, 30) + "…" : intent}
                                                    </span>
                                                )}
                                            </div>
                                            <p style={{ fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap", color: "var(--label-primary)", margin: 0 }}>
                                                {isTranslated && translatedMessages[idx] ? translatedMessages[idx] : msg.content}
                                            </p>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, paddingLeft: 2, paddingRight: 2 }}>
                                            {msg.date && (
                                                <span style={{ fontSize: 10, color: "var(--label-tertiary)" }}>
                                                    {new Date(msg.date).toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                                                </span>
                                            )}
                                            {tsPill}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                <div className="custom-scrollbar" style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", height: "100%", paddingRight: 2, paddingBottom: 8 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--label-tertiary)", margin: 0 }}>Engagement</p>
                    <StatBox label="Total Messages" value={messages.length} icon={MessageSquare} color="var(--blue)" />
                    <StatBox label="Incoming" value={messages.filter((m: any) => m.type === "user").length} icon={User} color="var(--green)" />
                    <StatBox label="Outgoing" value={messages.filter((m: any) => m.type === "bot").length} icon={Bot} color="var(--purple)" />

                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--label-tertiary)", margin: "8px 0 0" }}>Lead Info</p>
                    <div style={{ background: "var(--fill-quaternary)", border: "1px solid var(--hairline)", borderRadius: 9, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                        <div>
                            <span style={{ fontSize: 10, color: "var(--label-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Phone</span>
                            <p style={{ fontSize: 12, fontWeight: 500, color: "var(--label-primary)", margin: "2px 0 0", fontFamily: "ui-monospace, monospace" }}>{lead.phone}</p>
                        </div>
                        {lead.email && lead.email !== "-" && lead.email !== "No Email" && (
                            <div>
                                <span style={{ fontSize: 10, color: "var(--label-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Email</span>
                                <p style={{ fontSize: 12, fontWeight: 500, color: "var(--label-primary)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lead.email}</p>
                            </div>
                        )}
                        <div>
                            <span style={{ fontSize: 10, color: "var(--label-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Stage</span>
                            <p style={{ fontSize: 12, fontWeight: 500, color: "var(--label-primary)", margin: "2px 0 0", textTransform: "capitalize" }}>{lead.stage}</p>
                        </div>
                        {lead.wa_sentiment && (
                            <div>
                                <span style={{ fontSize: 10, color: "var(--label-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Sentiment</span>
                                <p style={{ fontSize: 12, fontWeight: 500, color: "var(--label-primary)", margin: "2px 0 0", textTransform: "capitalize" }}>{lead.wa_sentiment}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatBox({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
    return (
        <div style={{ padding: "9px 11px", borderRadius: 9, border: "1px solid var(--hairline)", background: "var(--fill-quaternary)", display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
                <Icon style={{ width: 13, height: 13 }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 10, color: "var(--label-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
                <span style={{ fontSize: 18, fontWeight: 600, color: "var(--label-primary)", lineHeight: 1.1, marginTop: 1 }}>{value}</span>
            </div>
        </div>
    );
}
