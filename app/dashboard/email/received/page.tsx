"use client";

import { WorldWideLoader } from "@/components/world-wide-loader";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, ChevronDown, ChevronUp, Reply, Search, ArrowDownLeft, ArrowUpRight, Link2, Check } from "lucide-react";
import { useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, subDays } from "date-fns";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useData } from "@/context/DataContext";
import { coerceTimestamp, parseJsonArray, isReplyTrackPositive } from "@/lib/outreach-types";
import type { OutreachLead } from "@/lib/outreach-types";
import { EmailBoardFilter } from "@/components/dashboard/email-board-filter";
import { boardOf, boardLabel, type EmailBoardKey } from "@/lib/email-board";

type ThreadMsg = {
    direction: "in" | "out";
    from: string;
    to: string;
    subject: string;
    body: string;
    bodyHtml: string;
    date: string | null;
};

/** Pull the ISO timestamp embedded in a reply-track string, e.g.
 *  "Yes - email done on 2026-09-05T10:00:00+03:00" or "Yes 2026-08-17T17:00:30.407+03:00". */
function extractTrackDate(raw: any): string | null {
    if (!raw) return null;
    const m = String(raw).match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^\s]*/);
    if (m && !isNaN(new Date(m[0]).getTime())) return m[0];
    return null;
}

const INBOUND_MARKERS = ["user", "inbound", "received", "customer", "reply", "incoming"];
const OUTBOUND_MARKERS = ["assistant", "bot", "agent", "outbound", "sent", "system"];

/** Parse a "qatar_timestamp"-style string: "DD-MM-YYYY HH:MM" or "DD/MM/YYYY HH:MM"
 *  (also tolerates a trailing comma after the date, e.g. "05/09/2026, 13:59"). */
function parseQatarTimestamp(raw: any): string | null {
    if (!raw) return null;
    const m = String(raw).trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4}),?\s+(\d{1,2}):(\d{2})/);
    if (!m) return null;
    const [, dd, mm, yyyy, hh, min] = m;
    // Asia/Qatar is UTC+03:00, fixed offset, no DST.
    const iso = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T${hh.padStart(2, "0")}:${min}:00+03:00`;
    return !isNaN(new Date(iso).getTime()) ? iso : null;
}

/** Some inbound messages carry their timestamp as a trailing line inside the text
 *  body itself (e.g. "...\n\nBest regards,\nAbeer\n\n05/09/2026, 13:59") rather than
 *  as a structured field. Pull it out and strip it from the displayed body. */
function extractTrailingTimestamp(text: string): { date: string | null; body: string } {
    const lines = String(text).split("\n");
    for (let i = lines.length - 1; i >= 0 && i >= lines.length - 3; i--) {
        const line = lines[i].trim();
        if (!line) continue;
        const iso = parseQatarTimestamp(line);
        if (iso) {
            return { date: iso, body: lines.slice(0, i).join("\n").trim() };
        }
        break; // only look at the last non-empty line
    }
    return { date: null, body: text };
}

/** Does this look like a full HTML email (our own template) rather than plain text? */
function looksLikeHtmlDocument(s: string): boolean {
    const head = s.trimStart().slice(0, 100).toLowerCase();
    return head.startsWith("<!doctype") || head.startsWith("<html") || /<\/?(table|div|p|br)\b/i.test(s.slice(0, 300));
}

/** Some rows store the body with LITERAL backslash-n / backslash-quote escape
 *  sequences (two characters: "\" + "n") instead of real newlines — undo it so a
 *  stored HTML document renders with real line breaks instead of visible "\n" text. */
function unescapeLiteralSequences(s: string): string {
    if (!/\\[nt"]/.test(s)) return s;
    return s
        .replace(/\\r\\n|\\n/g, "\n")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, '"');
}

/** Normalise one email_conversation entry into a ThreadMsg. */
function toThreadMsg(m: any): ThreadMsg | null {
    if (!m) return null;
    const roleRaw = String(m.role || m.direction || m.type || "").toLowerCase();
    const direction: "in" | "out" = INBOUND_MARKERS.includes(roleRaw)
        ? "in"
        : OUTBOUND_MARKERS.includes(roleRaw)
            ? "out"
            // No usable role at all — a message with no role/type in this schema is
            // the customer's reply (the outbound side always stamps role: assistant).
            : (roleRaw ? "out" : "in");

    let bodyHtml = m.body_html || m.html || "";
    let rawText = unescapeLiteralSequences(String(m.body_text || m.body || m.message || m.content || m.text || "").trim());

    // The "message" field sometimes holds a full HTML document rather than plain text.
    if (!bodyHtml && rawText && looksLikeHtmlDocument(rawText)) {
        bodyHtml = rawText;
        rawText = "";
    }

    // Structured date field first ("date" is ISO); fall back to qatar_timestamp;
    // fall back to a timestamp embedded as the last line of the plain-text body.
    let date = coerceTimestamp(m.date || m.timestamp || m.created_at || m.sent_at) || parseQatarTimestamp(m.qatar_timestamp);
    if (!date && rawText) {
        const extracted = extractTrailingTimestamp(rawText);
        if (extracted.date) { date = extracted.date; rawText = extracted.body; }
    }

    const body = rawText || (bodyHtml ? bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ") : "");
    if (!body && !bodyHtml) return null;

    return {
        direction,
        from: m.from || m.sender || "",
        to: m.to || m.recipient || "",
        subject: m.subject || "",
        body: String(body).trim(),
        bodyHtml: String(bodyHtml),
        date: date || null,
    };
}

function buildThread(lead: OutreachLead): ThreadMsg[] {
    const conv = parseJsonArray(lead.email_conversation);
    const msgs = conv.map(toThreadMsg).filter((x): x is ThreadMsg => !!x);
    // chronological
    msgs.sort((a, b) => (a.date ? new Date(a.date).getTime() : 0) - (b.date ? new Date(b.date).getTime() : 0));
    return msgs;
}

export default function ReceivedEmailsPage() {
    const { leads: allLeads, loadingLeads } = useData();
    const [threads, setThreads] = useState<any[]>([]);
    const loading = loadingLeads;
    const [searchQuery, setSearchQuery] = useState("");
    const [dateRange, setDateRange] = useState<any>({ from: subDays(new Date(), 7), to: new Date() });
    const [sortBy, setSortBy] = useState("newest");
    const [board, setBoard] = useState<EmailBoardKey>("all");

    useEffect(() => {
        if (loadingLeads) return;
        const out: any[] = [];

        (allLeads as OutreachLead[]).forEach((lead, index) => {
            // Gate purely on email_reply_track carrying a value (e.g. "Yes - email done on <ISO>").
            if (!isReplyTrackPositive(lead.email_reply_track)) return;
            const thread = buildThread(lead);
            const trackDate = extractTrackDate(lead.email_reply_track);
            const lastInbound = [...thread].reverse().find(m => m.direction === "in");
            const replyDate = trackDate || lastInbound?.date || lead.last_activity || lead.updated_at || lead.created_at || new Date().toISOString();
            const bk = boardOf(lead);

            out.push({
                id: `${lead.lead_id || index}-email-thread`,
                shareKey: (lead.crm_id || lead.lead_id || ""),
                board: bk,
                boardLabel: boardLabel(bk),
                sender: lead.email || "No Email Provided",
                senderName: lead.name || "Lead",
                subject: thread.find(m => m.subject)?.subject || "Email Reply",
                replyDateISO: replyDate,
                replyDateLabel: (() => { try { return format(new Date(replyDate), "MMM dd, yyyy • p"); } catch { return "Unknown Date"; } })(),
                sentiment: lead.email_sentiment || null,
                propertyType: lead.property_type || "",
                propertyCategory: lead.property_category || "",
                messageCount: thread.length,
                thread,
            });
        });

        out.sort((a, b) => new Date(b.replyDateISO).getTime() - new Date(a.replyDateISO).getTime());
        setThreads(out);
    }, [allLeads, loadingLeads]);

    const filtered = useMemo(() => {
        const result = threads.filter(t => {
            if (board !== "all" && t.board !== board) return false;
            const q = searchQuery.toLowerCase();
            if (q) {
                const inThread = t.thread.some((m: ThreadMsg) => m.body.toLowerCase().includes(q));
                if (!t.sender.toLowerCase().includes(q) && !t.senderName.toLowerCase().includes(q) && !inThread) return false;
            }
            if (dateRange?.from) {
                const rd = t.replyDateISO ? new Date(t.replyDateISO) : null;
                if (!rd || isNaN(rd.getTime())) return false;
                const from = new Date(dateRange.from); from.setHours(0, 0, 0, 0);
                const to = dateRange.to ? new Date(dateRange.to) : new Date(from); to.setHours(23, 59, 59, 999);
                if (rd < from || rd > to) return false;
            }
            return true;
        });
        return result.sort((a, b) => {
            const da = new Date(a.replyDateISO).getTime();
            const db = new Date(b.replyDateISO).getTime();
            return sortBy === "newest" ? db - da : da - db;
        });
    }, [threads, searchQuery, dateRange, sortBy, board]);

    const metrics = useMemo(() => {
        let pos = 0, neg = 0;
        filtered.forEach(t => {
            const s = String(t.sentiment || "").toLowerCase();
            if (s.includes("positive")) pos++;
            if (s.includes("negative")) neg++;
        });
        return { total: filtered.length, pos, neg };
    }, [filtered]);

    return (
        <div className="pb-10 relative min-h-[500px]" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {loading && <WorldWideLoader />}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "var(--ls-heading)", color: "var(--label-primary)" }}>Received Emails</h1>
                    <p style={{ fontSize: 13, color: "var(--label-secondary)", marginTop: 2 }}>Full email threads from your outreach — replies and follow-ups</p>
                </div>
                <DateRangePicker onUpdate={values => setDateRange(values.range)} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                <MetricTile label="Conversations" value={loading ? "…" : metrics.total.toLocaleString()} color="var(--green)" icon={<Mail style={{ width: 15, height: 15 }} />} />
                <MetricTile label="Positive Sentiment" value={loading ? "…" : metrics.pos.toLocaleString()} color="var(--green)" icon={<ArrowUpRight style={{ width: 15, height: 15 }} />} />
                <MetricTile label="Negative Sentiment" value={loading ? "…" : metrics.neg.toLocaleString()} color="var(--orange)" icon={<ArrowDownLeft style={{ width: 15, height: 15 }} />} />
            </div>

            <div className="email-two-col" style={{ display: "grid", gap: 16, alignItems: "start" }}>
                <aside className="liquid-card email-filter-rail" style={{ padding: "14px 14px", display: "flex", flexDirection: "column", gap: 12, alignSelf: "start" }}>
                    <div style={{ position: "relative" }}>
                        <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "var(--label-tertiary)" }} />
                        <Input placeholder="Search sender or message text..." style={{ paddingLeft: 30, height: 36, width: "100%", background: "var(--fill-tertiary)", border: "1px solid var(--glass-border)", color: "var(--label-primary)", fontSize: 12, borderRadius: "var(--radius-md)" }} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    </div>
                    <div>
                        <label style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--label-tertiary)", marginBottom: 5 }}>Board</label>
                        <EmailBoardFilter value={board} onChange={setBoard} width="100%" />
                    </div>
                    <div>
                        <label style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--label-tertiary)", marginBottom: 5 }}>Sort</label>
                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger style={{ width: "100%", height: 36, fontSize: 12 }}><SelectValue placeholder="Sort By" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="newest">Newest First</SelectItem>
                                <SelectItem value="oldest">Oldest First</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <button style={{ fontSize: 11, fontWeight: 600, color: "var(--label-secondary)", background: "var(--fill-tertiary)", border: "1px solid var(--glass-border)", padding: "7px 12px", borderRadius: "var(--radius-sm)", cursor: "pointer", height: 34 }} onClick={() => { setSearchQuery(""); setSortBy("newest"); setBoard("all"); }}>
                        Reset
                    </button>
                </aside>

                <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
                    {!loading && filtered.map(t => <EmailThreadCard key={t.id} thread={t} />)}
                    {!loading && filtered.length === 0 && (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 200, color: "var(--label-tertiary)", border: "1px dashed var(--hairline)", borderRadius: "var(--radius-xl)" }}>
                            <Mail style={{ width: 28, height: 28, marginBottom: 8, opacity: 0.4 }} />
                            <p style={{ fontSize: 13 }}>No email conversations found.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function MetricTile({ label, value, color, icon }: { label: string; value: string; color: string; icon: ReactNode }) {
    return (
        <div className="liquid-card" style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--label-tertiary)" }}>{label}</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: "var(--label-primary)", letterSpacing: "var(--ls-metric)", marginTop: 2 }}>{value}</p>
            </div>
            <div style={{ flexShrink: 0, padding: 9, borderRadius: "var(--radius-md)", background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
                {icon}
            </div>
        </div>
    );
}

/** Full HTML documents (our own branded email templates) need their own
 *  document context — <head>/<style>/<html> injected into a plain <div> gets
 *  mangled by the browser. Render those in a sandboxed, self-sizing iframe. */
function isFullHtmlDocument(html: string): boolean {
    const head = html.trimStart().slice(0, 100).toLowerCase();
    return head.startsWith("<!doctype") || head.startsWith("<html");
}

const PREVIEW_HEIGHT = 130;

/** Read the rendered content height of a same-document (srcDoc) iframe.
 *  No sandbox attribute is set, so this stays same-origin and never throws —
 *  but guard it anyway in case a browser/extension still blocks access. */
function readFrameHeight(frame: HTMLIFrameElement | null): number | null {
    try {
        const doc = frame?.contentWindow?.document;
        return doc?.body ? doc.body.scrollHeight + 20 : null;
    } catch {
        return null;
    }
}

/** Small, non-interactive preview strip. Clicking anywhere opens the full
 *  email in a modal — the preview itself never needs its own scrollbar or
 *  clickable links, so no sandbox restrictions are needed on it either. */
function EmailHtmlPreview({ html, onOpen }: { html: string; onOpen: () => void }) {
    const ref = useRef<HTMLIFrameElement>(null);
    const [naturalHeight, setNaturalHeight] = useState(500);

    return (
        <div
            onClick={onOpen}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onOpen(); }}
            style={{ position: "relative", height: PREVIEW_HEIGHT, overflow: "hidden", borderRadius: 8, cursor: "pointer" }}
        >
            <iframe
                ref={ref}
                srcDoc={html}
                onLoad={() => { const h = readFrameHeight(ref.current); if (h) setNaturalHeight(Math.min(1400, h)); }}
                title="Email preview"
                tabIndex={-1}
                style={{ width: "100%", height: naturalHeight, border: "none", background: "#fff", display: "block", pointerEvents: "none" }}
            />
            <div
                style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.94) 88%)",
                }}
            />
            <div
                style={{
                    position: "absolute", bottom: 6, right: 8,
                    display: "flex", alignItems: "center", gap: 4,
                    fontSize: 11, fontWeight: 600, color: "var(--blue)",
                    background: "var(--bg-layer1)", padding: "2px 8px", borderRadius: 20,
                    border: "1px solid var(--hairline)",
                }}
            >
                View full email <ChevronDown style={{ width: 11, height: 11 }} />
            </div>
        </div>
    );
}

/** Full email rendered in a modal, at its natural height. */
function EmailHtmlModal({ html, open, onOpenChange }: { html: string; open: boolean; onOpenChange: (v: boolean) => void }) {
    const ref = useRef<HTMLIFrameElement>(null);
    const [height, setHeight] = useState(600);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[88vh] overflow-hidden p-0 gap-0">
                <DialogHeader className="sr-only"><DialogTitle>Email content</DialogTitle></DialogHeader>
                <div style={{ maxHeight: "88vh", overflowY: "auto" }}>
                    <iframe
                        ref={ref}
                        srcDoc={html}
                        onLoad={() => { const h = readFrameHeight(ref.current); if (h) setHeight(Math.min(2000, h)); }}
                        title="Email content"
                        style={{ width: "100%", height, border: "none", background: "#fff", display: "block", borderRadius: 8 }}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}

function EmailThreadCard({ thread }: { thread: any }) {
    const [isOpen, setIsOpen] = useState(false);
    const [openHtmlIndex, setOpenHtmlIndex] = useState<number | null>(null);
    const [copied, setCopied] = useState(false);

    const shareUrl = typeof window !== "undefined" && thread.shareKey
        ? `${window.location.origin}/email/share/${encodeURIComponent(thread.shareKey)}`
        : "";

    const handleCopyShare = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!shareUrl) return;
        try {
            await navigator.clipboard.writeText(shareUrl);
        } catch {
            const ta = document.createElement("textarea");
            ta.value = shareUrl;
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand("copy"); } catch { }
            document.body.removeChild(ta);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const renderBody = (msg: ThreadMsg): string => {
        if (msg.bodyHtml) return msg.bodyHtml;
        const html = msg.body
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: var(--blue); text-decoration: underline;">$1</a>')
            .replace(/\n\n/g, "</p><p style='margin:0 0 10px'>")
            .replace(/\n/g, "<br/>");
        return `<p style="margin:0 0 10px">${html}</p>`;
    };

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="liquid-card" style={{ padding: 0, overflow: "hidden" }}>
            <CollapsibleTrigger asChild>
                <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                    <div style={{ width: 42, height: 42, flexShrink: 0, background: "rgba(48,209,88,0.12)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(48,209,88,0.2)" }}>
                        <Reply style={{ width: 16, height: 16, color: "var(--green)" }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                            <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--label-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{thread.senderName}</h4>
                            <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 7px", borderRadius: "var(--radius-xs)", fontSize: 10, fontWeight: 700, background: "var(--fill-tertiary)", color: "var(--label-secondary)" }}>{thread.messageCount} messages</span>
                            {thread.board && thread.board !== "leads" && (
                                <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: "var(--radius-xs)", fontSize: 10, fontWeight: 700, background: "rgba(10,132,255,0.12)", color: "var(--blue)", border: "1px solid rgba(10,132,255,0.25)" }}>{thread.boardLabel}</span>
                            )}
                            {thread.board === "leads" && (
                                <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: "var(--radius-xs)", fontSize: 10, fontWeight: 700, background: "rgba(48,209,88,0.12)", color: "var(--green)", border: "1px solid rgba(48,209,88,0.25)" }}>Leads</span>
                            )}
                            {thread.propertyType && (
                                <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: "var(--radius-xs)", fontSize: 10, fontWeight: 700, textTransform: "capitalize", background: "rgba(175,82,222,0.12)", color: "var(--purple)", border: "1px solid rgba(175,82,222,0.25)" }}>{thread.propertyType}</span>
                            )}
                            {thread.sentiment && (
                                <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 7px", borderRadius: "var(--radius-xs)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", background: "rgba(175,82,222,0.10)", color: "var(--purple)" }}>{thread.sentiment}</span>
                            )}
                            <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 7px", borderRadius: "var(--radius-xs)", fontSize: 10, background: "rgba(10,132,255,0.08)", color: "var(--blue)" }}>{thread.replyDateLabel}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Mail style={{ width: 11, height: 11, color: "var(--label-tertiary)" }} />
                            <p style={{ fontSize: 11, color: "var(--label-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{thread.sender} · {thread.subject}</p>
                        </div>
                    </div>
                    <div style={{ flexShrink: 0, color: "var(--label-tertiary)" }}>
                        {isOpen ? <ChevronUp style={{ width: 14, height: 14 }} /> : <ChevronDown style={{ width: 14, height: 14 }} />}
                    </div>
                </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div style={{ padding: "4px 18px 18px", borderTop: "1px solid var(--hairline)", display: "flex", flexDirection: "column", gap: 10 }}>
                    {shareUrl && (
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                            <button
                                onClick={handleCopyShare}
                                style={{
                                    display: "flex", alignItems: "center", gap: 5,
                                    padding: "5px 11px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer",
                                    background: copied ? "rgba(48,209,88,0.15)" : "var(--blue)",
                                    border: `1px solid ${copied ? "rgba(48,209,88,0.30)" : "transparent"}`,
                                    color: copied ? "var(--green)" : "#fff",
                                }}
                            >
                                {copied ? <Check style={{ width: 12, height: 12 }} /> : <Link2 style={{ width: 12, height: 12 }} />}
                                {copied ? "Link Copied" : "Copy Share Link"}
                            </button>
                        </div>
                    )}
                    {thread.thread.map((msg: ThreadMsg, i: number) => {
                        const inbound = msg.direction === "in";
                        const isHtmlDoc = !!msg.bodyHtml && isFullHtmlDocument(msg.bodyHtml);
                        return (
                            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: inbound ? "flex-start" : "flex-end", width: "100%", marginTop: 12 }}>
                                <div style={{
                                    maxWidth: isHtmlDoc ? "100%" : "88%", width: isHtmlDoc ? "100%" : undefined, padding: "10px 13px", borderRadius: 12,
                                    background: inbound ? "rgba(48,209,88,0.09)" : "var(--fill-quaternary)",
                                    border: `1px solid ${inbound ? "rgba(48,209,88,0.20)" : "var(--hairline)"}`,
                                    borderTopLeftRadius: inbound ? 3 : 12,
                                    borderTopRightRadius: inbound ? 12 : 3,
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                                        {inbound ? <ArrowDownLeft style={{ width: 11, height: 11, color: "var(--green)" }} /> : <ArrowUpRight style={{ width: 11, height: 11, color: "var(--blue)" }} />}
                                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: inbound ? "var(--green)" : "var(--blue)" }}>
                                            {inbound ? "Received" : "Sent"}
                                        </span>
                                        {msg.from && <span style={{ fontSize: 10, color: "var(--label-tertiary)" }}>· {msg.from}</span>}
                                        {msg.date && <span style={{ fontSize: 10, color: "var(--label-tertiary)" }}>· {(() => { try { return format(new Date(msg.date), "MMM dd, p"); } catch { return ""; } })()}</span>}
                                    </div>
                                    {msg.subject && <p style={{ fontSize: 12, fontWeight: 600, color: "var(--label-primary)", margin: "0 0 6px" }}>{msg.subject}</p>}
                                    {msg.bodyHtml && isFullHtmlDocument(msg.bodyHtml) ? (
                                        <>
                                            <EmailHtmlPreview html={msg.bodyHtml} onOpen={() => setOpenHtmlIndex(i)} />
                                            <EmailHtmlModal
                                                html={msg.bodyHtml}
                                                open={openHtmlIndex === i}
                                                onOpenChange={v => setOpenHtmlIndex(v ? i : null)}
                                            />
                                        </>
                                    ) : (
                                        <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--label-primary)" }} className="email-content" dangerouslySetInnerHTML={{ __html: renderBody(msg) }} />
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}
