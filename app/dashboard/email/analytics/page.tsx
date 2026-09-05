"use client";

import { WorldWideLoader } from "@/components/world-wide-loader";
import {
    Send,
    TrendingUp,
    AlertTriangle,
    CheckCircle2,
    Users
} from "lucide-react";
import { useState, useMemo } from "react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from "recharts";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { subDays, format } from "date-fns";
import { useData } from "@/context/DataContext";
import { coerceTimestamp, isReplyTrackPositive } from "@/lib/outreach-types";
import type { OutreachLead } from "@/lib/outreach-types";
import { EmailBoardFilter } from "@/components/dashboard/email-board-filter";
import { matchesBoard, type EmailBoardKey } from "@/lib/email-board";

export default function EmailAnalyticsPage() {
    const { leads: allLeads, loadingLeads } = useData();
    const [board, setBoard] = useState<EmailBoardKey>("all");
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: subDays(new Date(), 30),
        to: new Date(),
    });

    const leadStats = useMemo(() => {
        if (loadingLeads) return { totalSent: 0, totalReplies: 0, totalPosSentiment: 0, totalNegSentiment: 0, totalLeads: 0 };
        const start = dateRange?.from;
        const end = dateRange?.to;
        const inRange = (d: Date | null) => {
            if (!d || isNaN(d.getTime())) return false;
            if (start && d < start) return false;
            if (end) { const toDate = new Date(end); toDate.setHours(23, 59, 59, 999); if (d > toDate) return false; }
            return true;
        };

        // email_slots already only contains slots where email_N itself has content
        // (see buildEmailSlots) — no need to re-check status/sent_at here.
        const filtered = (allLeads as OutreachLead[]).filter(lead => {
            if (!matchesBoard(lead, board)) return false;
            const hasEmail = lead.email_slots.length > 0 || isReplyTrackPositive(lead.email_reply_track);
            if (!hasEmail) return false;
            const dateRef = lead.email_slots.length > 0
                ? (coerceTimestamp(lead.email_slots[0]?.sent_at) || lead.created_at)
                : (lead.last_activity || lead.updated_at || lead.created_at);
            return inRange(dateRef ? new Date(dateRef) : null);
        });

        let sent = 0, replies = 0, posSentiment = 0, negSentiment = 0;
        filtered.forEach(lead => {
            sent += lead.email_slots.length;
            if (isReplyTrackPositive(lead.email_reply_track)) replies++;
            const sentiment = String(lead.email_sentiment || "").toLowerCase();
            if (sentiment.includes("positive")) posSentiment++;
            if (sentiment.includes("negative")) negSentiment++;
        });

        return { totalSent: sent, totalReplies: replies, totalPosSentiment: posSentiment, totalNegSentiment: negSentiment, totalLeads: filtered.length };
    }, [allLeads, loadingLeads, dateRange, board]);

    const chartData = useMemo(() => {
        if (loadingLeads) return [];
        const start = dateRange?.from;
        const end = dateRange?.to;

        const counts: Record<string, { date: string, sent: number, replies: number }> = {};

        (allLeads as OutreachLead[]).forEach(lead => {
            if (!matchesBoard(lead, board)) return;
            // Only leads with at least one real sent email (email_N present) contribute
            // to the "sent" trend — a lead with only reply-track activity has no sent count.
            if (lead.email_slots.length === 0) return;
            const dateRef = coerceTimestamp(lead.email_slots[0]?.sent_at) || lead.created_at;
            if (!dateRef) return;
            const d = new Date(dateRef);
            if (start && d < start) return;
            if (end) { const toDate = new Date(end); toDate.setHours(23, 59, 59, 999); if (d > toDate) return; }
            const dateKey = d.toISOString().split("T")[0];

            const sent = lead.email_slots.length;
            const isReplied = isReplyTrackPositive(lead.email_reply_track);

            if (!counts[dateKey]) counts[dateKey] = { date: dateKey, sent: 0, replies: 0 };
            counts[dateKey].sent += sent;
            if (isReplied) counts[dateKey].replies += 1;
        });

        return Object.values(counts)
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(item => ({
                ...item,
                displayDate: format(new Date(item.date + 'T00:00:00'), 'MMM dd')
            }));
    }, [allLeads, loadingLeads, dateRange, board]);

    const { totalSent, totalReplies, totalPosSentiment, totalNegSentiment, totalLeads } = leadStats;
    const replyRate = totalSent > 0 ? ((totalReplies / totalSent) * 100).toFixed(2) : "0.00";

    return (
        <div className="space-y-6 pb-10 relative min-h-[500px]">
            {loadingLeads && <WorldWideLoader />}

            {/* Header */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: 'var(--ls-heading)', color: 'var(--label-primary)' }}>Email Analytics</h1>
                    <p style={{ fontSize: 13, color: 'var(--label-secondary)', marginTop: 2 }}>Comprehensive campaign and outreach performance</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <EmailBoardFilter value={board} onChange={setBoard} />
                    <DateRangePicker onUpdate={({ range }) => setDateRange(range)} />
                </div>
            </div>

            {/* Campaign Performance */}
            <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--label-primary)', marginBottom: 10 }}>Campaign Performance</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <MetricCard label="Total Sent" value={totalSent.toLocaleString()} icon={Send} color="var(--blue)" />
                    <MetricCard label="Replies" value={totalReplies.toLocaleString()} subtext={`${replyRate}% Rate`} icon={TrendingUp} color="var(--blue)" />
                    <MetricCard label="Positive Sentiment" value={totalPosSentiment.toLocaleString()} icon={CheckCircle2} color="var(--green)" />
                    <MetricCard label="Negative Sentiment" value={totalNegSentiment.toLocaleString()} icon={AlertTriangle} color="var(--orange)" />
                    <MetricCard label="Leads Emailed" value={totalLeads.toLocaleString()} icon={Users} color="var(--label-secondary)" />
                </div>
            </div>

            {/* Campaign Outreach Trend Chart */}
            <div className="liquid-card" style={{ padding: '20px 24px' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--label-primary)', marginBottom: 16 }}>Campaign Outreach Trend</p>
                {chartData.length > 0 ? (
                    <div style={{ height: 360, width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0A84FF" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#0A84FF" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorReplies" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#30D158" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#30D158" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(127,127,127,0.1)" />
                                <XAxis dataKey="displayDate" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--label-tertiary)' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--label-tertiary)' }} />
                                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid var(--hairline)', background: 'var(--bg-layer1)', fontSize: 11, color: 'var(--label-primary)', boxShadow: 'var(--shadow-lg)' }} />
                                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: 'var(--label-secondary)' }} />
                                <Area type="monotone" dataKey="sent" name="Emails Sent" stroke="#0A84FF" fillOpacity={1} fill="url(#colorSent)" strokeWidth={2} />
                                <Area type="monotone" dataKey="replies" name="Replies Received" stroke="#30D158" fillOpacity={1} fill="url(#colorReplies)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--fill-quaternary)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--hairline)' }}>
                        <p style={{ fontSize: 12, color: 'var(--label-tertiary)' }}>No campaign data available in the selected range</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function MetricCard({ label, value, subtext, icon: Icon, color }: any) {
    return (
        <div className="liquid-card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--label-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
                <div style={{ padding: 6, borderRadius: 'var(--radius-sm)', background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
                    <Icon style={{ width: 13, height: 13 }} />
                </div>
            </div>
            <div>
                <h3 style={{ fontSize: 22, fontWeight: 700, color: 'var(--label-primary)', letterSpacing: 'var(--ls-metric)' }}>{value}</h3>
                {subtext && <p style={{ fontSize: 11, color: 'var(--label-secondary)', marginTop: 2 }}>{subtext}</p>}
            </div>
        </div>
    );
}
