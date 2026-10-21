"use client";

import { WorldWideLoader } from "@/components/world-wide-loader";
import {
    Send,
    TrendingUp,
    AlertTriangle,
    CheckCircle2,
    Users,
    Flame,
    Info
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
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
import {
    Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { subDays, format, startOfDay, endOfDay } from "date-fns";
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

export default function EmailAnalyticsPage() {
    const [board, setBoard] = useState<EmailBoardKey>("all");
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: subDays(new Date(), 30),
        to: new Date(),
    });
    const [metrics, setMetrics] = useState<EmailMetrics | null>(null);
    const [loadingLeads, setLoadingLeads] = useState(true);

    // All totals and the daily trend are computed server-side in
    // /api/metrics/email — the client only renders them.
    const fetchMetrics = useCallback(async (from: Date, to: Date, b: EmailBoardKey) => {
        setLoadingLeads(true);
        try {
            const fromISO = startOfDay(from).toISOString();
            const toISO = endOfDay(to).toISOString();
            const res = await fetch(`/api/metrics/email?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}&board=${encodeURIComponent(b)}`);
            setMetrics(res.ok ? await res.json() : null);
        } catch (err) {
            console.error('[email analytics fetch]', err);
            setMetrics(null);
        } finally {
            setLoadingLeads(false);
        }
    }, []);

    useEffect(() => {
        if (!dateRange?.from) return;
        fetchMetrics(dateRange.from, dateRange.to || dateRange.from, board);
    }, [dateRange, board, fetchMetrics]);

    const leadStats = metrics ?? { totalEmailsSent: 0, totalReplies: 0, totalPosSentiment: 0, totalNegSentiment: 0, totalEoiLeads: 0, totalLeadsEmailed: 0, perStep: [0, 0, 0, 0, 0, 0, 0, 0], dailyTrend: [] };

    const chartData = leadStats.dailyTrend.map(item => ({
        ...item,
        displayDate: format(new Date(item.date + 'T00:00:00'), 'MMM dd'),
    }));

    const { totalEmailsSent: totalSent, totalReplies, totalPosSentiment, totalNegSentiment, totalEoiLeads, totalLeadsEmailed: totalLeads } = leadStats;
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
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                    <MetricCard label="Total Sent" value={totalSent.toLocaleString()} icon={Send} color="var(--blue)" info="Every outreach email we actually sent in this date range, including every follow-up step." />
                    <MetricCard label="Replies" value={totalReplies.toLocaleString()} subtext={`${replyRate}% Rate`} icon={TrendingUp} color="var(--blue)" info="How many leads wrote back to one of our emails. The rate is Replies divided by Total Sent." />
                    <MetricCard label="Positive Sentiment" value={totalPosSentiment.toLocaleString()} icon={CheckCircle2} color="var(--green)" info="Leads whose reply our AI read as positive — interested, engaged, or asking for more info." />
                    <MetricCard label="Negative Sentiment" value={totalNegSentiment.toLocaleString()} icon={AlertTriangle} color="var(--orange)" info="Leads whose reply our AI read as negative — not interested, or asking to stop." />
                    <MetricCard label="Leads Emailed" value={totalLeads.toLocaleString()} icon={Users} color="var(--label-secondary)" info="The number of different leads we emailed in this date range — each lead counted once, however many follow-ups they got." />
                    <MetricCard label="EOI Leads" value={totalEoiLeads.toLocaleString()} icon={Flame} color="var(--purple)" info="Leads who clearly said they're interested in a property — a stronger signal than general positive sentiment." />
                </div>
            </div>

            {/* Campaign Outreach Trend Chart */}
            <div className="liquid-card" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--label-primary)' }}>Campaign Outreach Trend</p>
                    <InfoTooltip text="Each day, how many emails we sent (blue) vs. how many replies came back that same day (green)." />
                </div>
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

function MetricCard({ label, value, subtext, icon: Icon, color, info }: any) {
    return (
        <div className="liquid-card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--label-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
                    {info && <InfoTooltip text={info} />}
                </div>
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
