"use client";

import {
    Users, Mail, MessageCircle, Phone, TrendingUp, PieChart as PieChartIcon,
    MessageSquare, Inbox, Send
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
    const [dateRange, setDateRange] = useState<any>({
        from: subDays(new Date(), 7),
        to: new Date(),
    });

    const { leads: allLeads, loadingLeads, refreshLeads, calls, loadingCalls, refreshCalls } = useData();
    const router = useRouter();

    useEffect(() => {
        if (!dateRange?.from) return;
        refreshLeads({ from: dateRange.from, to: dateRange.to || dateRange.from });
        refreshCalls({ from: dateRange.from, to: dateRange.to || dateRange.from });
    }, [dateRange, refreshLeads, refreshCalls]);

    const loading = loadingLeads;

    /* ── Combined metrics from nr_wf + nurture ── */
    const metrics = useMemo(() => {
        if (loadingLeads) return null;

        const rangeFrom = dateRange?.from ? new Date(dateRange.from).getTime() : null;
        const rangeTo = dateRange?.to ? new Date(dateRange.to).getTime() : null;

        const inRange = (d: string | null) => {
            if (!d || !rangeFrom || !rangeTo) return true;
            const t = new Date(d).getTime();
            return t >= rangeFrom && t <= rangeTo;
        };

        let totalLeads = 0;
        let totalEmailsSent = 0;
        let totalEmailReplies = 0;
        let totalUnsubscribed = 0;
        let totalBounced = 0;
        let totalWaReachouts = 0;
        let totalWaReplies = 0;
        let introLeads = 0;
        let nurtureLeads = 0;

        allLeads.forEach((lead: any) => {
            const src = (lead.source_loop || "").toLowerCase();
            const isIntro = src === 'nr_wf' || src === 'intro';
            const isNurture = src === 'nurture';

            // Count all leads in range
            if (inRange(lead.created_at)) {
                totalLeads++;
                if (isIntro) introLeads++;
                if (isNurture) nurtureLeads++;
            }

            // Email: count using Email 1/2/3_TS for intro/followup, fallback to stages_passed
            // For nurture, count from stages_passed (no timestamp columns)
            if (isNurture) {
                const stages = lead.stages_passed || [];
                const fallbackDate = lead.email_sent_at || lead.updated_at || lead.created_at;
                stages.forEach((stage: string) => {
                    if (stage.toLowerCase().startsWith("email_") && inRange(fallbackDate)) totalEmailsSent++;
                });
            } else {
                let countedAny = false;
                const emailTimestamps = [lead.email_1_ts, lead.email_2_ts, lead.email_3_ts];
                emailTimestamps.forEach((ts: string | null) => {
                    if (ts && inRange(ts)) { totalEmailsSent++; countedAny = true; }
                });
                if (!countedAny) {
                    const stages = lead.stages_passed || [];
                    const fallbackDate = lead.email_sent_at || lead.updated_at || lead.created_at;
                    stages.forEach((stage: string) => {
                        if (stage.toLowerCase().startsWith("email_") && inRange(fallbackDate)) totalEmailsSent++;
                    });
                }
            }

            // Email replies - prefer user_email_replied from nr_wf, fallback to email_replied
            const emailReply = lead.user_email_replied || lead.email_replied;
            if (emailReply && !["no", "none", ""].includes(String(emailReply).toLowerCase().trim())) {
                const replyDate = lead.email_replied_ts || lead.updated_at || lead.created_at;
                if (inRange(replyDate)) totalEmailReplies++;
            }

            // Unsubscribed
            if (lead.unsubscribed && String(lead.unsubscribed).toLowerCase().includes("yes")) {
                if (inRange(lead.updated_at || lead.created_at)) totalUnsubscribed++;
            }

            // Bounced
            if (lead.email_bounced === true || lead.email_bounced === "true") {
                totalBounced++;
            }

            // WhatsApp reachouts: include W.P_1 campaign leads OR conversation-only leads
            const hasWPCampaign = !!lead['W.P_1'];
            const hasWAConv = !!(lead.whatsapp_last_contacted && (
                lead.whatsapp_message_count > 0 ||
                (Array.isArray(lead.whatsapp_conversation) && lead.whatsapp_conversation.length > 0)
            ));
            if (hasWPCampaign || hasWAConv) {
                const waDate = lead.whatsapp_last_contacted || lead['W.P_1 TS'] || lead['W.P_2 TS'] || lead.created_at;
                if (inRange(waDate)) totalWaReachouts++;
            }

            // WhatsApp replies: check whatsapp_conversation for user msgs, fallback to WP_Replied_track
            const waConv = Array.isArray(lead.whatsapp_conversation) ? lead.whatsapp_conversation : [];
            const hasWaConvReply = waConv.some((m: any) => m.role === 'user' || m.role === 'User');
            const wpTrack = lead.WP_Replied_track || lead['WP_Replied_track'];
            const hasWpReply = !!(wpTrack && String(wpTrack).trim() && !['no', 'none'].includes(String(wpTrack).trim().toLowerCase()));
            if (hasWaConvReply || hasWpReply) {
                if (inRange(lead.whatsapp_last_contacted || lead.created_at)) totalWaReplies++;
            }

            // Voice calls - counted from vapi_call_logs via calls array below
        });

        // Count voice calls from vapi_call_logs
        let totalVoiceCalls = 0;
        if (calls && calls.length > 0) {
            calls.forEach((call: any) => {
                const callDate = call.startedAt;
                if (callDate && inRange(callDate)) totalVoiceCalls++;
            });
        }

        return {
            totalLeads,
            introLeads,
            nurtureLeads,
            totalEmailsSent,
            totalEmailReplies,
            emailReplyRate: totalEmailsSent > 0 ? ((totalEmailReplies / totalEmailsSent) * 100).toFixed(1) : '0',
            totalUnsubscribed,
            totalBounced,
            totalWaReachouts,
            totalWaReplies,
            waReplyRate: totalWaReachouts > 0 ? ((totalWaReplies / totalWaReachouts) * 100).toFixed(1) : '0',
            totalVoiceCalls,
        };
    }, [allLeads, loadingLeads, calls, loadingCalls, dateRange]);

    /* ── Daily chart data ── */
    const chartData = useMemo(() => {
        if (!allLeads.length || loadingLeads) return [];
        const counts: Record<string, { date: string; leads: number }> = {};
        allLeads.forEach((lead: any) => {
            if (!lead.created_at) return;
            const key = new Date(lead.created_at).toISOString().slice(0, 10);
            if (!counts[key]) counts[key] = { date: key, leads: 0 };
            counts[key].leads++;
        });
        return Object.values(counts)
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(-30)
            .map(d => ({
                ...d,
                name: format(new Date(d.date + 'T00:00:00'), 'MMM dd'),
            }));
    }, [allLeads, loadingLeads]);

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
            <div className="metric-grid-7">
                <MetricTile
                    title="Total Leads"
                    value={loading ? '—' : (m?.totalLeads ?? 0).toLocaleString()}
                    trend="Active Leads"
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
                    trend="From both loops"
                    trendDir="neutral"
                    accentColor="var(--orange)"
                    icon={<Phone size={17} />}
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
                            <p style={{ fontSize: 12, color: 'var(--label-tertiary)' }}>Daily new leads across both loops</p>
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
