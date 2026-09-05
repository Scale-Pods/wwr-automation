"use client";

import { Mail, Send, Inbox, AlertCircle, CheckCircle2, MessageSquareText } from "lucide-react";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useState, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useRouter } from "next/navigation";
import { subDays } from "date-fns";
import { useData } from "@/context/DataContext";
import { WorldWideLoader } from "@/components/world-wide-loader";
import { coerceTimestamp, isReplyTrackPositive } from "@/lib/outreach-types";
import type { OutreachLead } from "@/lib/outreach-types";

function MetricTile({ title, subtitle, value, accentColor, icon, onClick }: {
    title: string; subtitle?: string; value: string | number;
    accentColor: string; icon: React.ReactNode; onClick?: () => void;
}) {
    return (
        <div className="metric-tile" style={{ "--tile-accent": accentColor, cursor: onClick ? "pointer" : "default" } as any}
            onClick={onClick}
            onMouseEnter={e => { if (onClick) e.currentTarget.style.transform = "translateY(-2px) scale(1.002)"; }}
            onMouseLeave={e => { if (onClick) e.currentTarget.style.transform = ""; }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ flex: 1 }}>
                    <div className="tile-label">{title}</div>
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
    const { leads: allLeads, loadingLeads } = useData();
    const [dateRange, setDateRange] = useState<any>({ from: subDays(new Date(), 7), to: new Date() });

    const data = useMemo(() => {
        const empty = { totalEmails: 0, totalReplies: 0, totalPosSentiment: 0, totalNegSentiment: 0, perStep: [0, 0, 0, 0, 0] };
        if (loadingLeads) return empty;

        const fromD = dateRange?.from ? new Date(dateRange.from) : null;
        const toD = dateRange?.to ? new Date(dateRange.to) : fromD;
        if (fromD) fromD.setHours(0, 0, 0, 0);
        if (toD) toD.setHours(23, 59, 59, 999);
        const inRange = (d: Date | null) => { if (!fromD || !toD) return true; if (!d) return false; return d >= fromD && d <= toD; };

        let totalEmails = 0, replyCount = 0, posSentiment = 0, negSentiment = 0;
        const perStep = [0, 0, 0, 0, 0];

        (allLeads as OutreachLead[]).forEach(lead => {
            lead.email_slots.forEach(s => {
                // email_slots only contains slots where email_N itself has content
                // (see buildEmailSlots) — s.raw is always present here.
                const ts = coerceTimestamp(s.sent_at) || coerceTimestamp(s.obj?.timestamp) || lead.created_at;
                if (inRange(ts ? new Date(ts) : null)) {
                    totalEmails++;
                    if (s.n >= 1 && s.n <= 5) perStep[s.n - 1]++;
                }
            });
            if (isReplyTrackPositive(lead.email_reply_track)) replyCount++;
            const sent = String(lead.email_sentiment || "").toLowerCase();
            if (sent.includes("positive")) posSentiment++;
            if (sent.includes("negative")) negSentiment++;
        });

        return { totalEmails, totalReplies: replyCount, totalPosSentiment: posSentiment, totalNegSentiment: negSentiment, perStep };
    }, [dateRange, allLeads, loadingLeads]);

    const replyRate = data.totalEmails > 0 ? ((data.totalReplies / data.totalEmails) * 100).toFixed(1) : "0";

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 40, position: "relative", minHeight: 500 }}>
            {loadingLeads && <WorldWideLoader />}

            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.022em", color: "var(--label-primary)", marginBottom: 4 }}>Email Marketing</h1>
                    <p style={{ fontSize: 14, color: "var(--label-secondary)" }}>Monitor your outreach email sequence</p>
                </div>
                <DateRangePicker onUpdate={r => { setDateRange(r.range); setDateSubtitle(r.label ? r.label.toLowerCase() : "selected range"); }} />
            </div>

            <div className="metric-grid-sm">
                <MetricTile title="Total Emails" subtitle={dateSubtitle} value={data.totalEmails.toLocaleString()} accentColor="var(--indigo)" icon={<Mail size={17} />} onClick={() => router.push("/dashboard/email/sent")} />
                <MetricTile title="Total Replies" subtitle={`${replyRate}% reply rate`} value={data.totalReplies.toLocaleString()} accentColor="var(--teal)" icon={<Inbox size={17} />} onClick={() => router.push("/dashboard/email/received")} />
                <MetricTile title="Positive Sentiment" subtitle="from email_sentiment" value={data.totalPosSentiment.toLocaleString()} accentColor="var(--green)" icon={<CheckCircle2 size={17} />} />
                <MetricTile title="Negative Sentiment" subtitle="from email_sentiment" value={data.totalNegSentiment.toLocaleString()} accentColor="var(--red)" icon={<AlertCircle size={17} />} />
                <MetricTile title="Reply Rate" subtitle={dateSubtitle} value={`${replyRate}%`} accentColor="var(--orange)" icon={<MessageSquareText size={17} />} />
            </div>

            <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <h2 style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.022em", color: "var(--label-primary)" }}>Per-Step Performance</h2>
                </div>
                <div className="metric-grid-sm">
                    {["Email 1", "Email 2", "Email 3", "Email 4", "Email 5"].map((name, i) => (
                        <BreakdownCard key={name} title={name} count={data.perStep[i]} total={data.totalEmails} accentColor="var(--blue)" />
                    ))}
                </div>
            </div>
        </div>
    );
}
