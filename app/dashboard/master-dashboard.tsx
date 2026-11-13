"use client";

import { emailStats, waStats, rangeFromDates } from "@/lib/channel-metrics";
import { getDefaultRange } from "@/lib/date-defaults";
import {
    Users, Mail, MessageCircle, Phone, TrendingUp, PieChart as PieChartIcon,
    MessageSquare, Inbox, Send, Building2
} from "lucide-react";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { subDays, format } from "date-fns";
import { WorldWideLoader } from "@/components/world-wide-loader";
import { useData } from "@/context/DataContext";
import { coerceTimestamp, isPropertyFinderLead } from "@/lib/outreach-types";

/* ── Custom Tooltip for Recharts ── */
function AppleTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: 'var(--glass-fill)',
            backdropFilter: 'blur(40px) saturate(180%)',
            border: '1px solid var(--glass-border)',
            borderRadius: 12,
            padding: '10px 14px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
        }}>
            <p style={{ fontSize: 12, color: 'var(--label-secondary)', marginBottom: 4, letterSpacing: '-0.01em' }}>{label}</p>
            {payload.map((p: any, i: number) => (
                <p key={i} style={{ fontSize: 14, fontWeight: 600, color: p.color || 'var(--label-primary)', letterSpacing: '-0.02em' }}>
                    {p.value?.toLocaleString()}
                </p>
            ))}
        </div>
    );
}

/* ── Liquid Glass Metric Tile ── */
function MetricTile({
    title, value, trend, trendDir = 'neutral', accentColor,
    icon, onClick,
}: {
    title: string;
    value: string;
    trend?: string;
    trendDir?: 'up' | 'down' | 'neutral';
    accentColor: string;
    icon: React.ReactNode;
    onClick?: () => void;
}) {
    const trendColors = { up: 'var(--green)', down: 'var(--red)', neutral: 'var(--label-secondary)' };

    return (
        <div
            className="metric-tile"
            style={{ '--tile-accent': accentColor, cursor: onClick ? 'pointer' : 'default' } as any}
            onClick={onClick}
            onMouseEnter={e => {
                if (onClick) e.currentTarget.style.transform = 'translateY(-2px) scale(1.002)';
            }}
            onMouseLeave={e => {
                if (onClick) e.currentTarget.style.transform = '';
            }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                    <span className="tile-label">{title}</span>
                </div>
                <div className="tile-icon-wrapper" style={{
                    background: `${accentColor}18`,
                    color: accentColor,
                }}>
                    {icon}
                </div>
            </div>
            <div className="tile-value tabular-nums">{value}</div>
            {trend && (
                <div className={`tile-trend ${trendDir}`}>
                    {trend}
                </div>
            )}
        </div>
    );
}

export default function MasterDashboard() {
    const [dateRange, setDateRange] = useState<any>(getDefaultRange());

    const {
        leads: allLeads, loadingLeads, refreshLeads, calls, loadingCalls, refreshCalls,
        masterLeadsTotal, loadingMasterLeadsTotal, refreshMasterLeadsTotal,
    } = useData();
    const router = useRouter();

    useEffect(() => {
        if (!dateRange?.from) return;
        refreshLeads({ from: dateRange.from, to: dateRange.to || dateRange.from });
        refreshCalls({ from: dateRange.from, to: dateRange.to || dateRange.from });
        refreshMasterLeadsTotal({ from: dateRange.from, to: dateRange.to || dateRange.from });
    }, [dateRange, refreshLeads, refreshCalls, refreshMasterLeadsTotal]);

    const loading = loadingLeads;

    /* ── Combined metrics from outreach_table + vapi_call_logs ── */
    const metrics = useMemo(() => {
        if (loadingLeads) return null;

        const rangeFrom = dateRange?.from ? new Date(dateRange.from).getTime() : null;
        const rangeTo = dateRange?.to ? new Date(dateRange.to).setHours(23, 59, 59, 999) : null;

        const inRange = (d: string | null) => {
            if (!d || !rangeFrom || !rangeTo) return true;
            const t = new Date(d).getTime();
            return t >= rangeFrom && t <= rangeTo;
        };

        let totalLeads = 0;
        let totalEmailsSent = 0;
        let totalEmailReplies = 0;
        let totalWaReachouts = 0;
        let totalWaReplies = 0;
        let totalPfLeads = 0;

        allLeads.forEach((lead: any) => {
            if (inRange(lead.created_at)) totalLeads++;
            if (isPropertyFinderLead(lead) && inRange(lead.created_at)) totalPfLeads++;
        });

        // Email + WhatsApp numbers come from the shared definitions in
        // lib/channel-metrics.ts so they match every email / WhatsApp page.
        const mRange = rangeFromDates(dateRange?.from, dateRange?.to);
        const rawRows = allLeads.map((l: any) => l.raw || l);
        const em = emailStats(rawRows, mRange);
        const wa = waStats(rawRows, mRange);
        totalEmailsSent = em.emailsSent;
        totalEmailReplies = em.replies;
        totalWaReachouts = wa.uniqueContacted;
        totalWaReplies = wa.replies;

        // Voice calls from vapi_call_logs (already date-scoped by refreshCalls)
        let totalVoiceCalls = 0;
        if (calls && calls.length > 0) {
            calls.forEach((call: any) => {
                if (call.startedAt && inRange(call.startedAt)) totalVoiceCalls++;
            });
        }

        return {
            totalLeads,
            totalEmailsSent,
            totalEmailReplies,
            emailReplyRate: totalEmailsSent > 0 ? ((totalEmailReplies / totalEmailsSent) * 100).toFixed(1) : '0',
            totalWaReachouts,
            totalWaReplies,
            waReplyRate: totalWaReachouts > 0 ? ((totalWaReplies / totalWaReachouts) * 100).toFixed(1) : '0',
            totalVoiceCalls,
            totalPfLeads,
        };
    }, [allLeads, loadingLeads, calls, loadingCalls, dateRange]);

    /* ── Daily chart data: one point per day of the SELECTED range (zero-filled, Qatar days).
          Ranges longer than ~3 months roll up to months so the axis stays readable. ── */
    const chartData = useMemo(() => {
        if (loadingLeads) return [];
        const OFFSET = 3 * 3600000, DAY = 86400000;
        const qDay = (ms: number) => new Date(ms + OFFSET).toISOString().slice(0, 10);

        const times: number[] = [];
        allLeads.forEach((lead: any) => {
            const t = lead.created_at ? new Date(lead.created_at).getTime() : NaN;
            if (!isNaN(t)) times.push(t);
        });
        if (!times.length && !dateRange?.from) return [];

        // Range = the picker's range; if it was cleared, span all leads.
        const r = dateRange?.from
            ? rangeFromDates(dateRange.from, dateRange.to)
            : { from: Math.min(...times), to: Math.max(...times) };
        const from = r.from as number, to = Math.min(r.to as number, Date.now() + DAY);

        const days = Math.max(1, Math.round((new Date(qDay(to)).getTime() - new Date(qDay(from)).getTime()) / DAY) + 1);
        const monthly = days > 92;
        const bucketOf = (iso: string) => (monthly ? iso.slice(0, 7) : iso);

        const counts: Record<string, number> = {};
        for (let i = 0; i < days; i++) {
            const iso = new Date(new Date(qDay(from)).getTime() + i * DAY).toISOString().slice(0, 10);
            counts[bucketOf(iso)] = 0;
        }
        times.forEach(t => {
            if (t < from || t > to) return;
            const k = bucketOf(qDay(t));
            if (k in counts) counts[k]++;
        });

        return Object.entries(counts).map(([key, leads]) => ({
            date: key,
            leads,
            name: monthly ? format(new Date(key + '-01T00:00:00'), 'MMM yyyy') : format(new Date(key + 'T00:00:00'), 'MMM dd'),
        }));
    }, [allLeads, loadingLeads, dateRange]);

    /* ── Channel mix data ── */
    const serviceDistribution = useMemo(() => {
        if (!metrics) return [];
        return [
            { name: 'Email', value: metrics.totalEmailsSent, color: 'var(--blue)' },
            { name: 'WhatsApp', value: metrics.totalWaReachouts, color: 'var(--green)' },
            { name: 'Voice', value: metrics.totalVoiceCalls, color: 'var(--purple)' },
        ].filter(d => d.value > 0);
    }, [metrics]);

    const m = metrics;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, paddingBottom: 40, position: 'relative', minHeight: 500 }}>
            {loading && <WorldWideLoader />}

            {/* ── Page Header ── */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.022em', color: 'var(--label-primary)', marginBottom: 4 }}>
                        Master Overview
                    </h1>
                    <p style={{ fontSize: 14, color: 'var(--label-secondary)', letterSpacing: '-0.011em' }}>
                        Combined performance across all channels
                    </p>
                </div>
                <DateRangePicker onUpdate={({ range }) => setDateRange(range)} />
            </div>

            {/* ── Unified Metric Row ── */}
            <div className="metric-grid-6">
                <MetricTile
                    title="Total Leads"
                    value={loading ? '—' : (m?.totalLeads ?? 0).toLocaleString()}
                    trend="From outreach_table"
                    trendDir="neutral"
                    accentColor="var(--blue)"
                    icon={<Users size={17} />}
                    onClick={() => router.push('/dashboard/leads')}
                />
                <MetricTile
                    title="Emails Sent"
                    value={loading ? '—' : (m?.totalEmailsSent ?? 0).toLocaleString()}
                    trend={`${m?.emailReplyRate ?? 0}% reply rate`}
                    trendDir="up"
                    accentColor="var(--indigo)"
                    icon={<Send size={17} />}
                    onClick={() => router.push('/dashboard/email/sent')}
                />
                <MetricTile
                    title="Email Replies"
                    value={loading ? '—' : (m?.totalEmailReplies ?? 0).toLocaleString()}
                    trend="Received replies"
                    trendDir="neutral"
                    accentColor="var(--teal)"
                    icon={<Inbox size={17} />}
                    onClick={() => router.push('/dashboard/email/received')}
                />
               
                <MetricTile
                    title="WA Reachouts"
                    value={loading ? '—' : (m?.totalWaReachouts ?? 0).toLocaleString()}
                    trend={`${m?.waReplyRate ?? 0}% reply rate`}
                    trendDir="up"
                    accentColor="var(--green)"
                    icon={<MessageCircle size={17} />}
                    onClick={() => router.push('/dashboard/whatsapp/chat')}
                />
                <MetricTile
                    title="WA Replies"
                    value={loading ? '—' : (m?.totalWaReplies ?? 0).toLocaleString()}
                    trend="Replied to WhatsApp"
                    trendDir="neutral"
                    accentColor="var(--purple)"
                    icon={<MessageSquare size={17} />}
                    onClick={() => router.push('/dashboard/whatsapp/chat')}
                />
                <MetricTile
                    title="Voice Calls"
                    value={loading ? '—' : (m?.totalVoiceCalls ?? 0).toLocaleString()}
                    trend="AI voice agent"
                    trendDir="neutral"
                    accentColor="var(--orange)"
                    icon={<Phone size={17} />}
                    onClick={() => router.push('/dashboard/voice/logs')}
                />
            </div>

            {/* ── Charts ── */}
            <div className="charts-grid-2-1">
                {/* Lead Acquisition Chart */}
                <div className="liquid-card" style={{ padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: 9,
                            background: 'rgba(0,122,255,0.12)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--blue)',
                        }}>
                            <TrendingUp size={15} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.022em', color: 'var(--label-primary)' }}>
                                Lead Acquisition
                            </h3>
                            <p style={{ fontSize: 12, color: 'var(--label-tertiary)' }}>Daily new leads</p>
                        </div>
                    </div>
                    <div style={{ height: 280 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="gradLeads" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%"   stopColor="var(--blue)" stopOpacity={0.30} />
                                        <stop offset="75%"  stopColor="var(--blue)" stopOpacity={0.05} />
                                        <stop offset="100%" stopColor="var(--blue)" stopOpacity={0}    />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 6" stroke="var(--separator)" strokeWidth={0.5} />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false} tickLine={false}
                                    tick={{ fontSize: 11, fill: 'var(--label-tertiary)', fontWeight: 500 }}
                                    dy={8}
                                />
                                <YAxis
                                    axisLine={false} tickLine={false}
                                    tick={{ fontSize: 11, fill: 'var(--label-tertiary)', fontWeight: 500 }}
                                />
                                <Tooltip content={<AppleTooltip />} />
                                <Area
                                    type="monotone" dataKey="leads"
                                    stroke="var(--blue)" strokeWidth={2}
                                    fill="url(#gradLeads)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Channel Mix Donut */}
                <div className="liquid-card" style={{ padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: 9,
                            background: 'rgba(175,82,222,0.12)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--purple)',
                        }}>
                            <PieChartIcon size={15} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.022em', color: 'var(--label-primary)' }}>
                                Channel Mix
                            </h3>
                            <p style={{ fontSize: 12, color: 'var(--label-tertiary)' }}>Outreach distribution</p>
                        </div>
                    </div>
                    <div style={{ height: 220 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={serviceDistribution}
                                    cx="50%" cy="50%"
                                    innerRadius={55} outerRadius={80}
                                    paddingAngle={4} dataKey="value"
                                >
                                    {serviceDistribution.map((entry, i) => (
                                        <Cell key={i} fill={entry.color} strokeWidth={0} />
                                    ))}
                                </Pie>
                                <Tooltip content={<AppleTooltip />} />
                                <Legend
                                    iconType="circle" iconSize={8}
                                    wrapperStyle={{ fontSize: 12, color: 'var(--label-secondary)' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
