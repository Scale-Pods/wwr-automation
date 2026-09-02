"use client";

import { MessageCircle, Send, Users, MessageSquare, TrendingUp, BarChart3 } from "lucide-react";
import { WorldWideLoader } from "@/components/world-wide-loader";
import { useEffect, useState, useMemo, useCallback } from "react";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { useRouter } from "next/navigation";
import { isReplyTrackPositive, coerceTimestamp } from "@/lib/outreach-types";

function waActivity(lead: any) {
    let sent = 0;
    for (let n = 1; n <= 4; n++) if (lead[`wa_${n}`]) sent++;
    const conv = Array.isArray(lead.whatsapp_conversation) ? lead.whatsapp_conversation : [];
    const convSent = conv.filter((m: any) => {
        const r = m?.role || m?.type || m?.sender;
        return r === "assistant" || r === "bot" || r === "agent";
    }).length;
    const replied = isReplyTrackPositive(lead.whatsapp_reply_track) ||
        conv.some((m: any) => { const r = m?.role || m?.type || m?.sender; return r === "user" || r === "User" || r === "customer"; });
    const lastDate = coerceTimestamp(lead.wa_1_sent_at) || lead.last_activity || lead.created_at || null;
    return { sent: convSent || sent, replied, lastDate };
}

/* ── Apple Metric Tile ── */
function MetricTile({ title, value, accentColor, icon, onClick, info }: {
    title: string; value: string; accentColor: string; icon: React.ReactNode;
    onClick?: () => void; info?: string;
}) {
    return (
        <div
            className="metric-tile"
            style={{ '--tile-accent': accentColor, cursor: onClick ? 'pointer' : 'default' } as any}
            onClick={onClick}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ flex: 1 }}>
                    <div className="tile-label">{title}</div>
                    <div className="tile-value tabular-nums">{value}</div>
                    {info && (
                        <div style={{ fontSize: 11, color: 'var(--label-tertiary)', marginTop: 6, lineHeight: 1.3 }}>
                            {info}
                        </div>
                    )}
                </div>
                <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: `${accentColor}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: accentColor, flexShrink: 0,
                }}>
                    {icon}
                </div>
            </div>
        </div>
    );
}

/* ── Custom Tooltip ── */
function AppleTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: 'var(--glass-fill)', backdropFilter: 'blur(40px) saturate(180%)',
            border: '1px solid var(--glass-border)', borderRadius: 12,
            padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
        }}>
            <p style={{ fontSize: 12, color: 'var(--label-secondary)', marginBottom: 4 }}>{label}</p>
            {payload.map((p: any, i: number) => (
                <p key={i} style={{ fontSize: 13, fontWeight: 600, color: p.color || 'var(--blue)', letterSpacing: '-0.01em' }}>
                    {p.name}: <span style={{ fontVariantNumeric: 'tabular-nums' }}>{p.value?.toLocaleString()}</span>
                </p>
            ))}
        </div>
    );
}

export default function WhatsAppDashboardPage() {
    const router = useRouter();
    const [dateRange, setDateRange] = useState<any>({ from: subDays(new Date(), 7), to: new Date() });
    const [waData, setWaData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async (from: Date, to: Date) => {
        setLoading(true);
        try {
            const fromISO = startOfDay(from).toISOString();
            const toISO = endOfDay(to).toISOString();
            const res = await fetch(`/api/whatsapp-leads?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`);
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            setWaData(data);
        } catch (err) {
            console.error('[WA dashboard fetch]', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!dateRange?.from) return;
        fetchData(dateRange.from, dateRange.to || dateRange.from);
    }, [dateRange, fetchData]);

    const stats = useMemo(() => {
        if (!waData) return { totalLeads: 0, sentCount: 0, uniqueSentCount: 0, totalReplies: 0, dailyTrend: [] as any[] };
        const allLeads = waData.leads || waData.nr_wf || [];

        const from = dateRange?.from ? startOfDay(new Date(dateRange.from)).getTime() : null;
        const to = endOfDay(new Date(dateRange?.to || dateRange?.from || new Date())).getTime();
        const inRange = (t: number | null) => !from || (t != null && t >= from && t <= to);

        let sentCount = 0;
        let totalReplies = 0;
        let uniqueSentCount = 0;
        const dailyMap: Record<string, { reachouts: number; replies: number }> = {};

        allLeads.forEach((lead: any) => {
            const a = waActivity(lead);
            const t = a.lastDate ? new Date(a.lastDate).getTime() : null;
            if (!inRange(t)) return;

            uniqueSentCount++;
            sentCount += a.sent;
            if (a.replied) totalReplies++;

            if (a.lastDate) {
                const dayKey = new Date(a.lastDate).toISOString().slice(0, 10);
                if (!dailyMap[dayKey]) dailyMap[dayKey] = { reachouts: 0, replies: 0 };
                dailyMap[dayKey].reachouts++;
                if (a.replied) dailyMap[dayKey].replies++;
            }
        });

        const dailyTrend = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, vals]) => ({ date, ...vals }));

        return { totalLeads: allLeads.length, sentCount, uniqueSentCount, totalReplies, dailyTrend };
    }, [waData, dateRange]);

    const trendData = useMemo(() => stats.dailyTrend.map(d => ({
        date: format(new Date(d.date + 'T00:00:00'), 'MMM dd'),
        sent: d.reachouts, replied: d.replies,
    })), [stats.dailyTrend]);

    const donutData = [
        { name: 'Unique Leads', value: stats.uniqueSentCount, color: 'var(--purple)' },
        { name: 'Total Messages', value: stats.sentCount,       color: 'var(--blue)'   },
        { name: 'Replies',        value: stats.totalReplies,    color: 'var(--green)'  },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40, position: 'relative', minHeight: 500 }}>
            {loading && <WorldWideLoader />}

            {/* Header */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.022em', color: 'var(--label-primary)', marginBottom: 4 }}>
                        WhatsApp CRM
                    </h1>
                    <p style={{ fontSize: 14, color: 'var(--label-secondary)' }}>
                        Real-time engagement insights and campaign totals
                    </p>
                </div>
                <DateRangePicker onUpdate={range => setDateRange(range.range)} />
            </div>

            {/* Metrics Overview */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(10,132,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--blue)' }}>
                        <Users size={14} />
                    </div>
                    <h2 style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.022em', color: 'var(--label-primary)' }}>
                        WhatsApp Overview
                    </h2>
                </div>
                <div className="metric-grid">
                    <MetricTile
                        title="Unique Leads Contacted"
                        value={loading ? '—' : stats.uniqueSentCount.toLocaleString()}
                        accentColor="var(--blue)"
                        icon={<Users size={17} />}
                        onClick={() => router.push('/dashboard/whatsapp/leads')}
                    />
                    <MetricTile
                        title="Total Replies"
                        value={loading ? '—' : stats.totalReplies.toLocaleString()}
                        accentColor="var(--green)"
                        icon={<MessageCircle size={17} />}
                    />
                    <MetricTile
                        title="Total Messages Sent"
                        value={loading ? '—' : stats.sentCount.toLocaleString()}
                        accentColor="var(--purple)"
                        icon={<Send size={17} />}
                    />
                </div>
            </div>

            {/* Charts */}
            <div className="charts-grid">
                {/* Conversion Funnel Donut */}
                <div className="liquid-card" style={{ padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: 9,
                            background: 'rgba(0,122,255,0.12)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--blue)',
                        }}>
                            <TrendingUp size={15} />
                        </div>
                        <h3 style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.022em', color: 'var(--label-primary)' }}>
                            Conversion Funnel
                        </h3>
                    </div>
                    <div style={{ height: 180 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                                    {donutData.map((entry, i) => (
                                        <Cell key={i} fill={entry.color} strokeWidth={0} />
                                    ))}
                                </Pie>
                                <Tooltip content={<AppleTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    {/* Legend */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12 }}>
                        {donutData.map(item => (
                            <div key={item.name} style={{
                                borderRadius: 10, padding: '10px 8px', textAlign: 'center',
                                background: `${item.color}14`,
                            }}>
                                <div style={{ fontSize: 16, fontWeight: 600, color: item.color, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                                    {item.value.toLocaleString()}
                                </div>
                                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--label-tertiary)', textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: 2 }}>
                                    {item.name}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Activity Trend */}
                <div className="liquid-card" style={{ padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: 9,
                            background: 'rgba(48,209,88,0.12)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--green)',
                        }}>
                            <BarChart3 size={15} />
                        </div>
                        <h3 style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.022em', color: 'var(--label-primary)' }}>
                            Activity Trend
                        </h3>
                    </div>
                    <div style={{ height: 200 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 6" stroke="var(--separator)" strokeWidth={0.5} />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--label-tertiary)' }} dy={8} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--label-tertiary)' }} />
                                <Tooltip content={<AppleTooltip />} />
                                <Line type="monotone" dataKey="sent" name="Sent" stroke="var(--blue)" strokeWidth={2} dot={{ r: 3, fill: 'var(--blue)', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                                <Line type="monotone" dataKey="replied" name="Replied" stroke="var(--green)" strokeWidth={2} dot={{ r: 3, fill: 'var(--green)', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    {/* Legend */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 12 }}>
                        {[{ color: 'var(--blue)', label: 'Sent' }, { color: 'var(--green)', label: 'Replied' }].map(item => (
                            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 20, height: 3, borderRadius: 2, background: item.color }} />
                                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--label-secondary)' }}>{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
