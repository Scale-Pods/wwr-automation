"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { Mail, Lock, ChevronDown, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { format } from "date-fns";

type ThreadMsg = {
    direction: "in" | "out";
    subject: string;
    body: string;
    bodyHtml: string;
    date: string | null;
};

const INBOUND_MARKERS = ["user", "inbound", "received", "customer", "reply", "incoming"];
const OUTBOUND_MARKERS = ["assistant", "bot", "agent", "outbound", "sent", "system"];

function unescapeLiteralSequences(s: string): string {
    if (!/\\[nt"]/.test(s)) return s;
    return s.replace(/\\r\\n|\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"');
}

function looksLikeHtmlDocument(s: string): boolean {
    const head = s.trimStart().slice(0, 100).toLowerCase();
    return head.startsWith("<!doctype") || head.startsWith("<html") || /<\/?(table|div|p|br)\b/i.test(s.slice(0, 300));
}
function isFullHtmlDocument(html: string): boolean {
    const head = html.trimStart().slice(0, 100).toLowerCase();
    return head.startsWith("<!doctype") || head.startsWith("<html");
}

function parseQatarTimestamp(raw: any): string | null {
    if (!raw) return null;
    const m = String(raw).trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4}),?\s+(\d{1,2}):(\d{2})/);
    if (!m) return null;
    const [, dd, mm, yyyy, hh, min] = m;
    const iso = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T${hh.padStart(2, "0")}:${min}:00+03:00`;
    return !isNaN(new Date(iso).getTime()) ? iso : null;
}

function coerceISO(v: any): string | null {
    if (!v) return null;
    const s = String(v).trim();
    if (s.includes("|")) {
        const part = s.split("|").pop()?.trim();
        if (part && !isNaN(new Date(part).getTime())) return part;
    }
    return !isNaN(new Date(s).getTime()) ? s : null;
}

function extractTrailingTimestamp(text: string): { date: string | null; body: string } {
    const lines = String(text).split("\n");
    for (let i = lines.length - 1; i >= 0 && i >= lines.length - 3; i--) {
        const line = lines[i].trim();
        if (!line) continue;
        const iso = parseQatarTimestamp(line);
        if (iso) return { date: iso, body: lines.slice(0, i).join("\n").trim() };
        break;
    }
    return { date: null, body: text };
}

function toThreadMsg(m: any): ThreadMsg | null {
    if (!m) return null;
    const roleRaw = String(m.role || m.direction || m.type || "").toLowerCase();
    const direction: "in" | "out" = INBOUND_MARKERS.includes(roleRaw)
        ? "in"
        : OUTBOUND_MARKERS.includes(roleRaw) ? "out" : (roleRaw ? "out" : "in");

    let bodyHtml = m.body_html || m.html || "";
    let rawText = unescapeLiteralSequences(String(m.body_text || m.body || m.message || m.content || m.text || "").trim());
    if (!bodyHtml && rawText && looksLikeHtmlDocument(rawText)) { bodyHtml = rawText; rawText = ""; }

    let date = coerceISO(m.date || m.timestamp || m.created_at || m.sent_at) || parseQatarTimestamp(m.qatar_timestamp);
    if (!date && rawText) {
        const ex = extractTrailingTimestamp(rawText);
        if (ex.date) { date = ex.date; rawText = ex.body; }
    }
    const body = rawText || (bodyHtml ? bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ") : "");
    if (!body && !bodyHtml) return null;
    return { direction, subject: m.subject || "", body: String(body).trim(), bodyHtml: String(bodyHtml), date: date || null };
}

function renderPlain(msg: ThreadMsg): string {
    const html = msg.body
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#0A84FF;text-decoration:underline">$1</a>')
        .replace(/\n\n/g, "</p><p style='margin:0 0 10px'>")
        .replace(/\n/g, "<br/>");
    return `<p style="margin:0 0 10px">${html}</p>`;
}

function EmailHtmlFrame({ html }: { html: string }) {
    const ref = useRef<HTMLIFrameElement>(null);
    const [expanded, setExpanded] = useState(false);
    const [fullHeight, setFullHeight] = useState(400);
    const resize = () => {
        try {
            const doc = ref.current?.contentWindow?.document;
            if (doc?.body) setFullHeight(Math.min(2000, doc.body.scrollHeight + 20));
        } catch { }
    };
    return (
        <div>
            <div style={{ height: expanded ? fullHeight : 150, overflow: "hidden", borderRadius: 8, position: "relative" }}>
                <iframe ref={ref} srcDoc={html} onLoad={resize} title="Email content"
                    style={{ width: "100%", height: fullHeight, border: "none", background: "#fff", display: "block", pointerEvents: expanded ? "auto" : "none" }} />
                {!expanded && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.94) 88%)" }} />}
            </div>
            <button onClick={() => setExpanded(v => !v)}
                style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6, fontSize: 11, fontWeight: 600, color: "#0A84FF", background: "none", border: "none", padding: "2px 0", cursor: "pointer" }}>
                {expanded ? "Collapse email" : "View full email"} <ChevronDown style={{ width: 11, height: 11 }} />
            </button>
        </div>
    );
}

export default function PublicEmailSharePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const decodedId = decodeURIComponent(id);

    const [data, setData] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/public/email-thread/${encodeURIComponent(decodedId)}`);
                if (!res.ok) { setError(res.status === 404 ? "Conversation not found" : "Failed to load conversation"); return; }
                setData(await res.json());
            } catch {
                setError("An error occurred");
            } finally {
                setLoading(false);
            }
        })();
    }, [decodedId]);

    const thread = useMemo<ThreadMsg[]>(() => {
        if (!data?.email_conversation) return [];
        let arr = data.email_conversation;
        if (typeof arr === "string") { try { arr = JSON.parse(arr); } catch { arr = []; } }
        if (!Array.isArray(arr)) return [];
        return arr.map(toThreadMsg).filter((x: ThreadMsg | null): x is ThreadMsg => !!x)
            .sort((a, b) => (a.date ? new Date(a.date).getTime() : 0) - (b.date ? new Date(b.date).getTime() : 0));
    }, [data]);

    if (loading) {
        return (
            <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9", color: "#64748b", fontSize: 13 }}>
                Loading conversation…
            </div>
        );
    }

    if (error || !data) {
        return (
            <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "#f1f5f9", color: "#64748b" }}>
                <Mail style={{ width: 40, height: 40, opacity: 0.3 }} />
                <p style={{ fontWeight: 600, color: "#475569" }}>{error || "Conversation not found"}</p>
                <p style={{ fontSize: 12, color: "#94a3b8" }}>If you believe this is an error, please contact support.</p>
            </div>
        );
    }

    return (
        <div style={{ minHeight: "100vh", background: "#f1f5f9", display: "flex", flexDirection: "column" }}>
            <div style={{ background: "#0f172a", color: "#fff", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 12, fontWeight: 500 }}>
                <Lock style={{ width: 12, height: 12, color: "#34d399" }} />
                <span>Secure Email Viewer • Public access restricted to this conversation only</span>
            </div>

            <div style={{ flex: 1, width: "100%", maxWidth: 760, margin: "0 auto", padding: "24px 16px" }}>
                <div style={{ background: "#fff", borderRadius: 20, boxShadow: "0 1px 3px rgba(15,23,42,0.06), 0 8px 28px rgba(15,23,42,0.07)", overflow: "hidden" }}>
                    <div style={{ padding: "18px 22px", borderBottom: "1px solid #e2e8f0" }}>
                        <h1 style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", margin: 0 }}>{data.name || "Email Conversation"}</h1>
                        <p style={{ fontSize: 12, color: "#64748b", margin: "3px 0 0" }}>
                            {data.email || ""}
                            {data.email_sentiment ? ` · ${data.email_sentiment}` : ""}
                            {` · ${thread.length} message${thread.length === 1 ? "" : "s"}`}
                        </p>
                    </div>

                    <div style={{ padding: "8px 22px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
                        {thread.length === 0 && (
                            <div style={{ padding: "40px 0", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No messages in this conversation.</div>
                        )}
                        {thread.map((msg, i) => {
                            const inbound = msg.direction === "in";
                            const isHtmlDoc = !!msg.bodyHtml && isFullHtmlDocument(msg.bodyHtml);
                            return (
                                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: inbound ? "flex-start" : "flex-end", width: "100%", marginTop: 12 }}>
                                    <div style={{
                                        maxWidth: isHtmlDoc ? "100%" : "88%", width: isHtmlDoc ? "100%" : undefined,
                                        padding: "10px 13px", borderRadius: 12,
                                        background: inbound ? "rgba(34,197,94,0.09)" : "#f1f5f9",
                                        border: `1px solid ${inbound ? "rgba(34,197,94,0.20)" : "#e2e8f0"}`,
                                        borderTopLeftRadius: inbound ? 3 : 12,
                                        borderTopRightRadius: inbound ? 12 : 3,
                                    }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                                            {inbound ? <ArrowDownLeft style={{ width: 11, height: 11, color: "#16a34a" }} /> : <ArrowUpRight style={{ width: 11, height: 11, color: "#0A84FF" }} />}
                                            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: inbound ? "#16a34a" : "#0A84FF" }}>
                                                {inbound ? "Received" : "Sent"}
                                            </span>
                                            {msg.date && <span style={{ fontSize: 10, color: "#94a3b8" }}>· {(() => { try { return format(new Date(msg.date), "MMM dd, p"); } catch { return ""; } })()}</span>}
                                        </div>
                                        {msg.subject && <p style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", margin: "0 0 6px" }}>{msg.subject}</p>}
                                        {isHtmlDoc ? (
                                            <EmailHtmlFrame html={msg.bodyHtml} />
                                        ) : (
                                            <div style={{ fontSize: 13, lineHeight: 1.6, color: "#0f172a" }} dangerouslySetInnerHTML={{ __html: renderPlain(msg) }} />
                                        )}
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
