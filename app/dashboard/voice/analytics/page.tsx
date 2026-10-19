"use client";

import { Phone, CheckCircle, PhoneIncoming, PhoneOff, PhoneMissed } from "lucide-react";
import { WorldWideLoader } from "@/components/world-wide-loader";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
} from "recharts";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
import { useData } from "@/context/DataContext";

export default function VoiceAnalyticsPage() {
    const { voiceMetrics, loadingVoiceMetrics, refreshVoiceMetrics } = useData();

    const [dateRange, setDateRange] = useState<any>({
        from: subDays(new Date(), 7),
        to: new Date(),
    });

    const loading = loadingVoiceMetrics;
    const m = voiceMetrics;

    useEffect(() => {
        if (!dateRange?.from) return;
        refreshVoiceMetrics({
            from: dateRange.from,
            to: dateRange.to || dateRange.from,
            includeElevenLabs: false,
        });
    }, [dateRange, refreshVoiceMetrics]);

    const volumeData = (m?.dailyVolume ?? []).map(d => ({
        name: format(new Date(d.date + 'T00:00:00'), 'MMM dd'),
        value: d.calls,
    }));

    const durationData = (m?.durationBuckets ?? []).map(b => ({
        name: b.label,
        value: b.calls,
    }));

    const ROUTE_META: Record<string, { label: string; color: string }> = {
        commercial: { label: 'Commercial', color: 'var(--orange)' },
        business: { label: 'Business', color: 'var(--blue)' },
        residential: { label: 'Residential', color: 'var(--green)' },
    };
    const routeBreakdown = m?.routeBreakdown ?? {};

    return (
        <div className="space-y-6 pb-10 relative min-h-[500px]">
            {loading && <WorldWideLoader />}

            {/* Header */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: 'var(--ls-heading)', color: 'var(--label-primary)' }}>Voice Analytics</h1>
                    <p style={{ fontSize: 13, color: 'var(--label-secondary)', marginTop: 2 }}>Comprehensive insights across all voice accounts.</p>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                    <DateRangePicker onUpdate={(values) => setDateRange(values.range)} />
                </div>
            </div>

            {/* Voice Performance Metrics */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <div style={{ padding: 6, borderRadius: 'var(--radius-md)', background: 'var(--blue)' }}>
                        <PhoneIncoming style={{ width: 14, height: 14, color: '#fff' }} />
                    </div>
                    <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--label-primary)' }}>Voice Analytics</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <StatCard title="Calls in Range" value={(m?.totalCalls ?? 0).toLocaleString()} change="Includes No Answer" icon={<Phone style={{ width: 18, height: 18 }} />} color="var(--blue)" />
                    <StatCard title="No Answer" value={(m?.noAnswerCalls ?? 0).toLocaleString()} change="Did Not Connect" icon={<PhoneMissed style={{ width: 18, height: 18 }} />} color="var(--red)" isNegative />
                    <StatCard title="Call Pick-up Rate" value={`${(m?.pickupRate ?? 0).toFixed(1)}%`} change="Assistant/customer ended call" icon={<Phone style={{ width: 18, height: 18 }} />} color="var(--purple)" />
                    <StatCard title="Completion Rate" value={`${(m?.completionRate ?? 0).toFixed(1)}%`} change="Completed Conversation" icon={<CheckCircle style={{ width: 18, height: 18 }} />} color="var(--green)" />
                    <StatCard title="Positive Response" value={`${(m?.positiveOrCuriousRate ?? 0).toFixed(1)}%`} change="Sentiment = Positive or Curious" icon={<CheckCircle style={{ width: 18, height: 18 }} />} color="var(--blue)" />
                </div>
            </div>

            {/* Route Breakdown (Commercial / Business / Residential) */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <div style={{ padding: 6, borderRadius: 'var(--radius-md)', background: 'var(--purple)' }}>
                        <PhoneOff style={{ width: 14, height: 14, color: '#fff' }} />
                    </div>
                    <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--label-primary)' }}>Calls by Route</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {(Object.keys(ROUTE_META) as Array<keyof typeof ROUTE_META>).map(route => {
                        const d = routeBreakdown[route] ?? { calls: 0, connected: 0, noAnswer: 0, positive: 0 };
                        const meta = ROUTE_META[route];
                        const connectRate = d.calls > 0 ? Math.round((d.connected / d.calls) * 1000) / 10 : 0;
                        return (
                            <div key={route} className="liquid-card" style={{ padding: '14px 16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{meta.label}</span>
                                    <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--label-primary)' }}>{d.calls}</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--label-secondary)' }}>
                                        <span>Connected</span>
                                        <span style={{ fontWeight: 600, color: 'var(--green)' }}>{d.connected} ({connectRate}%)</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--label-secondary)' }}>
                                        <span>No Answer / No Connect</span>
                                        <span style={{ fontWeight: 600, color: 'var(--red)' }}>{d.noAnswer}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--label-secondary)' }}>
                                        <span>Positive Sentiment</span>
                                        <span style={{ fontWeight: 600, color: 'var(--blue)' }}>{d.positive}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="liquid-card" style={{ padding: 16 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--label-primary)', marginBottom: 12 }}>Call Volume Trends</p>
                    <div style={{ width: '100%', height: 280 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={volumeData.length ? volumeData : [{ name: 'No data', value: 0 }]}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(127,127,127,0.1)" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--label-tertiary)' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--label-tertiary)' }} />
                                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid var(--hairline)', background: 'var(--bg-layer1)', fontSize: 11, color: 'var(--label-primary)', boxShadow: 'var(--shadow-lg)' }} />
                                <Line type="monotone" dataKey="value" stroke="#0A84FF" strokeWidth={2.5} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="liquid-card" style={{ padding: 16 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--label-primary)', marginBottom: 12 }}>Duration Distribution</p>
                    <div style={{ width: '100%', height: 280 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={durationData.length ? durationData : [{ name: 'No data', value: 0 }]}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(127,127,127,0.1)" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--label-tertiary)' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--label-tertiary)' }} />
                                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid var(--hairline)', background: 'var(--bg-layer1)', fontSize: 11, color: 'var(--label-primary)', boxShadow: 'var(--shadow-lg)' }} cursor={{ fill: 'rgba(127,127,127,0.06)' }} />
                                <Bar dataKey="value" fill="#AF52DE" radius={[4, 4, 0, 0]} barSize={36} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, change, icon, color, isNegative }: any) {
    return (
        <div className="liquid-card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--label-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{title}</p>
                    <h3 style={{ fontSize: 22, fontWeight: 700, color: 'var(--label-primary)', letterSpacing: 'var(--ls-metric)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</h3>
                    <span style={{ fontSize: 11, fontWeight: 600, color: isNegative ? 'var(--red)' : 'var(--green)' }}>
                        {change} {isNegative ? '↓' : '↑'}
                    </span>
                </div>
                {icon && (
                    <div style={{ padding: 12, borderRadius: 'var(--radius-lg)', flexShrink: 0, background: `color-mix(in srgb, ${color} 12%, transparent)`, color: color }}>
                        {icon}
                    </div>
                )}
            </div>
        </div>
    );
}
