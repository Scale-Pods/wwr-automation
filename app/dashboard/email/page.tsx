"use client";

import { Mail, Send, Inbox, AlertCircle, CheckCircle2, MessageSquareText, Flame, Info } from "lucide-react";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useState, useEffect, useCallback } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import {
    Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRouter } from "next/navigation";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { WorldWideLoader } from "@/components/world-wide-loader";
import { EmailBoardFilter } from "@/components/dashboard/email-board-filter";
import { type EmailBoardKey } from "@/lib/email-board";
import type { EmailMetrics } from "@/app/api/metrics/email/route";

function InfoTooltip({ text }: { text: string }) {
    return (
        <TooltipProvider>
            <UITooltip>
                <TooltipTrigger asChild>
                    <div style={{ display: "inline-flex", cursor: "help" }}>
                        <Info style={{ width: 13, height: 13, color: "var(--label-tertiary)" }} />
                    </div>
                </TooltipTrigger>
                <TooltipContent style={{ maxWidth: 240, padding: "8px 10px", fontSize: 11, lineHeight: 1.5, background: "var(--bg-layer1)", color: "var(--label-primary)", border: "1px solid var(--hairline)" }}>
                    {text}
                </TooltipContent>
            </UITooltip>
        </TooltipProvider>
    );
}

function MetricTile({ title, subtitle, value, accentColor, icon, onClick, info }: {
    title: string; subtitle?: string; value: string | number;
    accentColor: string; icon: React.ReactNode; onClick?: () => void; info?: string;
}) {
    return (
        <div className="metric-tile" style={{ "--tile-accent": accentColor, cursor: onClick ? "pointer" : "default" } as any}
            onClick={onClick}
            onMouseEnter={e => { if (onClick) e.currentTarget.style.transform = "translateY(-2px) scale(1.002)"; }}
            onMouseLeave={e => { if (onClick) e.currentTarget.style.transform = ""; }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <div className="tile-label">{title}</div>
                        {info && <InfoTooltip text={info} />}
                    </div>
                    <div className="tile-value tabular-nums" style={{ fontSize: 30 }}>{value}</div>
                    {subtitle && <div className="tile-trend neutral">{subtitle}</div>}
                </div>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: `${accentColor}18`, display: "flex", alignItems: "center", justifyContent: "center", color: accentColor, flexShrink: 0 }}>
                    {icon}
                </div>
            </div>
        </div>
    );
}

function BreakdownCard({ title, count, total, accentColor }: { title: string; count: number; total: number; accentColor: string; }) {
    const pct = total > 0 ? parseFloat(((count / total) * 100).toFixed(1)) : 0;
    const data = [{ value: pct }, { value: 100 - pct }];
    return (
        <div className="liquid-card" style={{ padding: "20px 20px 24px", textAlign: "center" }}>
            <div style={{ height: 110, position: "relative", marginBottom: 4 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={data} cx="50%" cy="50%" innerRadius={30} outerRadius={45} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                            <Cell fill={accentColor} />
                            <Cell fill={`${accentColor}14`} />
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--label-primary)" }}>{pct}%</span>
                </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 300, letterSpacing: "-0.03em", color: "var(--label-primary)", fontVariantNumeric: "tabular-nums", marginBottom: 4 }}>{count.toLocaleString()}</div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: accentColor }}>{title}</div>
            <div style={{ fontSize: 11, color: "var(--label-tertiary)", marginTop: 2 }}>Emails Sent</div>
        </div>
    );
}

export default function EmailDashboardPage() {
    const router = useRouter();
    const [dateSubtitle, setDateSubtitle] = useState("Last 7 days");
    const [dateRange, setDateRange] = useState<any>({ from: subDays(new Date(), 7), to: new Date() });
    const [board, setBoard] = useState<EmailBoardKey>("all");
    const [metrics, setMetrics] = useState<EmailMetrics | null>(null);
    const [loading, setLoading] = useState(true);

    // All totals (sent, replies, sentiment, EOI leads) are computed server-side
    // in /api/metrics/email — the client only displays them.
    const fetchMetrics = useCallback(async (from: Date, to: Date, b: EmailBoardKey) => {
        setLoading(true);
        try {
            const fromISO = startOfDay(from).toISOString();
            const toISO = endOfDay(to).toISOString();
            const res = await fetch(`/api/metrics/email?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}&board=${encodeURIComponent(b)}`);
            setMetrics(res.ok ? await res.json() : null);
        } catch (err) {
            console.error('[email dashboard fetch]', err);
            setMetrics(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!dateRange?.from) return;
        fetchMetrics(dateRange.from, dateRange.to || dateRange.from, board);
    }, [dateRange, board, fetchMetrics]);

    const data = metrics ?? { totalEmailsSent: 0, totalReplies: 0, totalPosSentiment: 0, totalNegSentiment: 0, totalEoiLeads: 0, totalLeadsEmailed: 0, perStep: [0, 0, 0, 0, 0, 0, 0, 0], dailyTrend: [] };
    const totalEmails = data.totalEmailsSent;
    const replyRate = totalEmails > 0 ? ((data.totalReplies / totalEmails) * 100).toFixed(1) : "0";
    const loadingLeads = loading;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 40, position: "relative", minHeight: 500 }}>
            {loadingLeads && <WorldWideLoader />}

            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.022em", color: "var(--label-primary)", marginBottom: 4 }}>Email Marketing</h1>
                    <p style={{ fontSize: 14, color: "var(--label-secondary)" }}>Monitor your outreach email sequence</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <EmailBoardFilter value={board} onChange={setBoard} />
                    <DateRangePicker onUpdate={r => { setDateRange(r.range); setDateSubtitle(r.label ? r.label.toLowerCase() : "selected range"); }} />
                </div>
            </div>

            <div className="metric-grid-sm">
                <MetricTile title="Total Emails" subtitle={dateSubtitle} value={totalEmails.toLocaleString()} accentColor="var(--indigo)" icon={<Mail size={17} />} onClick={() => router.push("/dashboard/email/sent")} info="Every outreach email we actually sent in this date range, including every follow-up step." />
                <MetricTile title="Total Replies" subtitle={`${replyRate}% reply rate`} value={data.totalReplies.toLocaleString()} accentColor="var(--teal)" icon={<Inbox size={17} />} onClick={() => router.push("/dashboard/email/received")} info="How many leads actually wrote back to one of our emails." />
                <MetricTile title="Positive Sentiment" subtitle="Leads who sounded interested" value={data.totalPosSentiment.toLocaleString()} accentColor="var(--green)" icon={<CheckCircle2 size={17} />} info="Leads whose reply our AI read as positive — interested, engaged, or asking for more info." />
                <MetricTile title="Negative Sentiment" subtitle="Leads who sounded uninterested" value={data.totalNegSentiment.toLocaleString()} accentColor="var(--red)" icon={<AlertCircle size={17} />} info="Leads whose reply our AI read as negative — not interested, or asking to stop." />
                <MetricTile title="Reply Rate" subtitle={dateSubtitle} value={`${replyRate}%`} accentColor="var(--orange)" icon={<MessageSquareText size={17} />} info="Total Replies divided by Total Emails — the share of emails that got a reply." />
                <MetricTile title="EOI Leads" subtitle="Expression of Interest" value={data.totalEoiLeads.toLocaleString()} accentColor="var(--purple)" icon={<Flame size={17} />} info="Leads who clearly said they're interested in a property — a stronger signal than general positive sentiment." />
            </div>

            <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <h2 style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.022em", color: "var(--label-primary)" }}>Per-Step Performance</h2>
                        <InfoTooltip text="Our outreach sends up to 8 follow-up emails per lead. This shows how many of each step (Email 1, Email 2, …) actually went out, and what share of the total that is." />
                    </div>
                </div>
                <div className="metric-grid-sm">
                    {["Email 1", "Email 2", "Email 3", "Email 4", "Email 5", "Email 6", "Email 7", "Email 8"].map((name, i) => (
                        <BreakdownCard key={name} title={name} count={data.perStep[i]} total={totalEmails} accentColor="var(--blue)" />
                    ))}
                </div>
            </div>
        </div>
    );
}
