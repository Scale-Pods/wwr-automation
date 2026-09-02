"use client";

import { WorldWideLoader } from "@/components/world-wide-loader";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, ChevronDown, ChevronUp, Reply, Search, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format, subDays } from "date-fns";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useData } from "@/context/DataContext";
import { coerceTimestamp, parseJsonArray } from "@/lib/outreach-types";
import type { OutreachLead } from "@/lib/outreach-types";

type ThreadMsg = {
    direction: "in" | "out";
    from: string;
    to: string;
    subject: string;
    body: string;
    bodyHtml: string;
    date: string | null;
};

/** Normalise one email_conversation entry into a ThreadMsg. */
function toThreadMsg(m: any): ThreadMsg | null {
    if (!m) return null;
    const roleRaw = String(m.role || m.direction || m.type || "").toLowerCase();
    const direction: "in" | "out" =
        roleRaw === "user" || roleRaw === "inbound" || roleRaw === "received" || roleRaw === "customer" || roleRaw === "reply"
            ? "in"
            : "out";
    const bodyHtml = m.body_html || m.html || "";
    const body = m.body_text || m.body || m.message || m.content || m.text || (bodyHtml ? bodyHtml.replace(/<[^>]+>/g, " ") : "");
    if (!body && !bodyHtml) return null;
    return {
        direction,
        from: m.from || m.sender || "",
        to: m.to || m.recipient || "",
        subject: m.subject || "",
        body: String(body).trim(),
        bodyHtml: String(bodyHtml),
        date: coerceTimestamp(m.timestamp || m.date || m.created_at || m.sent_at) || null,
    };
}

function buildThread(lead: OutreachLead): ThreadMsg[] {
    const conv = parseJsonArray(lead.email_conversation);
    const msgs = conv.map(toThreadMsg).filter((x): x is ThreadMsg => !!x);
    // Fall back: synthesise from sent email_slots + a single inbound stub
    if (msgs.length === 0) {
        lead.email_slots.forEach(s => {
            if (s.raw == null && !s.sent_at) return;
            msgs.push({
                direction: "out",
                from: s.obj?.from || "",
                to: s.obj?.to || lead.email,
                subject: s.obj?.subject || `Email ${s.n}`,
                body: (s.obj?.body_text || s.body || "").toString().trim(),
                bodyHtml: s.obj?.body_html || "",
                date: coerceTimestamp(s.sent_at) || coerceTimestamp(s.obj?.timestamp) || null,
            });
        });
        const t = typeof lead.email_reply_track === "string" && lead.email_reply_track.trim().toLowerCase() !== "yes"
            ? lead.email_reply_track.trim()
            : lead.email_note || "Email reply received";
        msgs.push({
            direction: "in",
            from: lead.email,
            to: "",
            subject: "Re:",
            body: String(t),
            bodyHtml: "",
            date: coerceTimestamp(lead.last_activity) || lead.updated_at || null,
        });
    }
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

    useEffect(() => {
        if (loadingLeads) return;
        const out: any[] = [];

        (allLeads as OutreachLead[]).forEach((lead, index) => {
            if (!lead.email_replied) return;
            const thread = buildThread(lead);
            const lastInbound = [...thread].reverse().find(m => m.direction === "in");
            const replyDate = lastInbound?.date || lead.last_activity || lead.updated_at || lead.created_at || new Date().toISOString();

            out.push({
                id: `${lead.lead_id || index}-email-thread`,
                sender: lead.email || "No Email Provided",
                senderName: lead.name || "Lead",
                subject: thread.find(m => m.subject)?.subject || "Email Reply",
                replyDateISO: replyDate,
                replyDateLabel: (() => { try { return format(new Date(replyDate), "MMM dd, yyyy • p"); } catch { return "Unknown Date"; } })(),
                sentiment: lead.email_sentiment || null,
                messageCount: thread.length,
                thread,
            });
        });

        out.sort((a, b) => new Date(b.replyDateISO).getTime() - new Date(a.replyDateISO).getTime());
        setThreads(out);
    }, [allLeads, loadingLeads]);

    const filtered = useMemo(() => {
        const result = threads.filter(t => {
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
    }, [threads, searchQuery, dateRange, sortBy]);

    return (
        <div className="space-y-5 pb-10 max-w-5xl mx-auto relative min-h-[500px]">
            {loading && <WorldWideLoader />}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "var(--ls-heading)", color: "var(--label-primary)" }}>Received Emails</h1>
                    <p style={{ fontSize: 13, color: "var(--label-secondary)", marginTop: 2 }}>Full email threads from your outreach — replies and follow-ups</p>
                </div>
                <DateRangePicker onUpdate={values => setDateRange(values.range)} />
            </div>

            <div className="liquid-card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                    <h3 style={{ fontSize: 24, fontWeight: 700, color: "var(--label-primary)" }}>{loading ? "..." : filtered.length} conversations</h3>
                    <p style={{ fontSize: 12, color: "var(--label-secondary)", marginTop: 2 }}>Leads that replied by email</p>
                </div>
                <div style={{ padding: 12, borderRadius: "var(--radius-lg)", background: "rgba(48,209,88,0.12)", color: "var(--green)" }}>
                    <Mail style={{ width: 20, height: 20 }} />
                </div>
            </div>

            <div className="liquid-card" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
                        <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "var(--label-tertiary)" }} />
                        <Input placeholder="Search sender or message text..." style={{ paddingLeft: 30, height: 36, background: "var(--fill-tertiary)", border: "1px solid var(--glass-border)", color: "var(--label-primary)", fontSize: 12, borderRadius: "var(--radius-md)" }} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    </div>
                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger style={{ width: 140, height: 36, fontSize: 12 }}><SelectValue placeholder="Sort By" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="newest">Newest First</SelectItem>
                            <SelectItem value="oldest">Oldest First</SelectItem>
                        </SelectContent>
                    </Select>
                    <button style={{ fontSize: 11, fontWeight: 600, color: "var(--label-secondary)", background: "var(--fill-tertiary)", border: "1px solid var(--glass-border)", padding: "5px 12px", borderRadius: "var(--radius-sm)", cursor: "pointer", height: 36 }} onClick={() => { setSearchQuery(""); setSortBy("newest"); }}>
                        Reset
                    </button>
                </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {!loading && filtered.map(t => <EmailThreadCard key={t.id} thread={t} />)}
                {!loading && filtered.length === 0 && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 200, color: "var(--label-tertiary)", border: "1px dashed var(--hairline)", borderRadius: "var(--radius-xl)" }}>
                        <Mail style={{ width: 28, height: 28, marginBottom: 8, opacity: 0.4 }} />
                        <p style={{ fontSize: 13 }}>No email conversations found.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function EmailThreadCard({ thread }: { thread: any }) {
    const [isOpen, setIsOpen] = useState(false);

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
                    {thread.thread.map((msg: ThreadMsg, i: number) => {
                        const inbound = msg.direction === "in";
                        return (
                            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: inbound ? "flex-start" : "flex-end", width: "100%", marginTop: 12 }}>
                                <div style={{
                                    maxWidth: "88%", padding: "10px 13px", borderRadius: 12,
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
                                    <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--label-primary)" }} className="email-content" dangerouslySetInnerHTML={{ __html: renderBody(msg) }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}
