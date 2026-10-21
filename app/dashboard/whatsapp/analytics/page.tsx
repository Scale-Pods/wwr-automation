"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area,
} from "recharts";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { TrendingUp, Users, MessageSquare, Send, RefreshCw, Info, Flame } from "lucide-react";
import {
    Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { subDays, startOfDay, endOfDay, format } from "date-fns";
import { WorldWideLoader } from "@/components/world-wide-loader";
import { isReplyTrackPositive, parseJsonArray, isInboundMessage, waMessagesSent, lastWaActivityDate } from "@/lib/outreach-types";

function waActivity(lead: any) {
    const conv = parseJsonArray(lead.whatsapp_conversation);
    const sent = waMessagesSent(lead);
    const replied = isReplyTrackPositive(lead.whatsapp_reply_track) || conv.some(isInboundMessage);
    const lastDate = lastWaActivityDate(lead);
    return { sent, replied, lastDate };
}

export default function WhatsappAnalyticsPage() {
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
        from: subDays(new Date(), 7),
        to: new Date(),
    });

    const [leads, setLeads] = useState<any[]>([]);
    const [serverMetrics, setServerMetrics] = useState<{ totalPositiveLeads: number } | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async (from: Date, to: Date) => {
        setLoading(true);
        const fromISO = startOfDay(from).toISOString();
        const toISO = endOfDay(to).toISOString();
        try {
            const [r, m] = await Promise.all([
                fetch(`/api/whatsapp-leads?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`),
                fetch(`/api/metrics/whatsapp?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`),
            ]);
            const d = r.ok ? await r.json() : null;
            setLeads(d ? (d.leads || d.nr_wf || []) : []);
            // Positive leads (wa_sentiment = "hot") is computed server-side in
            // /api/metrics/whatsapp — never re-derived from raw rows on the client.
            setServerMetrics(m.ok ? await m.json() : null);
        } catch {
            setLeads([]);
            setServerMetrics(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!dateRange?.from) return;
        fetchData(dateRange.from, dateRange.to || dateRange.from);
    }, [dateRange, fetchData]);

    const stats = useMemo(() => {
        const from = dateRange?.from ? startOfDay(dateRange.from).getTime() : null;
        const to = endOfDay(dateRange?.to || dateRange?.from || new Date()).getTime();
        const inRange = (t: number | null) => !from || (t != null && t >= from && t <= to);

        let uniqueSentCount = 0, sentCount = 0, totalReplies = 0;
        const dailyMap: Record<string, { reachouts: number; replies: number }> = {};

        leads.forEach(lead => {
            const a = waActivity(lead);
            const t = a.lastDate ? new Date(a.lastDate).getTime() : null;
            if (!inRange(t) && t != null) return;

            uniqueSentCount++;
            sentCount += a.sent;
            if (a.replied) totalReplies++;

            if (a.lastDate) {
                const key = new Date(a.lastDate).toISOString().slice(0, 10);
                if (!dailyMap[key]) dailyMap[key] = { reachouts: 0, replies: 0 };
                dailyMap[key].reachouts++;
                if (a.replied) dailyMap[key].replies++;
            }
        });

        const trendData = Object.entries(dailyMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, { reachouts, replies }]) => ({
                date: format(new Date(date + "T00:00:00"), "MMM dd"),
                sent: reachouts,
                replied: replies,
            }));

        return { uniqueSentCount, sentCount, totalReplies, trendData };
    }, [leads, dateRange]);

    const replyRate = stats.uniqueSentCount > 0 ? ((stats.totalReplies / stats.uniqueSentCount) * 100).toFixed(1) : "0.0";

    return (
        <div className="space-y-4 pb-4 relative min-h-[500px]">
            {loading && <WorldWideLoader />}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "var(--ls-heading)", color: "var(--label-primary)" }}>WhatsApp Analytics</h1>
                    <p style={{ fontSize: 13, color: "var(--label-secondary)", marginTop: 2 }}>Track outreach performance and lead engagement</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <DateRangePicker onUpdate={({ range }) => setDateRange({ from: range?.from, to: range?.to })} />
                    <button onClick={() => { if (dateRange?.from) fetchData(dateRange.from, dateRange.to || dateRange.from); }}
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "var(--radius-md)", border: "1px solid var(--glass-border)", background: "var(--fill-tertiary)", color: "var(--label-secondary)", cursor: "pointer" }}>
                        <RefreshCw style={{ width: 14, height: 14 }} />
                    </button>
                </div>
            </div>

            <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: "var(--label-tertiary)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>WhatsApp Campaign Performance</p>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <StatCard title="Messages Sent" value={loading ? "..." : stats.sentCount.toLocaleString()} icon={Send} color="var(--blue)" info="Every WhatsApp message we sent out to leads in this date range, across all follow-ups." />
                    <StatCard title="Unique Contacted" value={loading ? "..." : stats.uniqueSentCount.toLocaleString()} icon={Users} color="var(--label-secondary)" info="The number of different leads we messaged on WhatsApp in this date range — each lead counted once, no matter how many messages they got." />
                    <StatCard title="Total Replies" value={loading ? "..." : stats.totalReplies.toLocaleString()} icon={MessageSquare} color="var(--green)" info="How many of those leads replied back to us on WhatsApp." />
                    <StatCard title="Response Rate" value={loading ? "..." : `${replyRate}%`} icon={TrendingUp} color="var(--purple)" info="Total Replies divided by Unique Contacted — the share of contacted leads who wrote back." />
                    <StatCard title="Positive Leads" value={loading ? "..." : (serverMetrics?.totalPositiveLeads ?? 0).toLocaleString()} icon={Flame} color="var(--red)" info="Leads our AI marked as 'hot' based on how interested they sounded in the conversation." />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                <div className="liquid-card" style={{ padding: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--label-primary)" }}>Engagement Trend</p>
                        <InfoTooltip text="Each day, how many leads we reached out to on WhatsApp (blue) vs. how many wrote back that same day (green)." />
                    </div>
                    <p style={{ fontSize: 11, color: "var(--label-tertiary)", marginBottom: 12 }}>Outbound reachouts vs incoming replies per day</p>
                    <div style={{ height: 260, width: "100%" }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.trendData}>
                                <defs>
                                    <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0A84FF" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#0A84FF" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorReplied" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#30D158" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#30D158" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(127,127,127,0.1)" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--label-tertiary)" }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--label-tertiary)" }} />
                                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--hairline)", background: "var(--bg-layer1)", fontSize: 11, color: "var(--label-primary)", boxShadow: "var(--shadow-lg)" }} />
                                <Area type="monotone" dataKey="sent" name="Reachouts" stroke="#0A84FF" strokeWidth={2} fill="url(#colorSent)" />
                                <Area type="monotone" dataKey="replied" name="Replies" stroke="#30D158" strokeWidth={2} fill="url(#colorReplied)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}

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

function StatCard({ title, value, icon: Icon, color, info }: any) {
    return (
        <div className="liquid-card" style={{ padding: "12px 14px", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", gap: 10 }}>
            {info && (
                <div style={{ position: "absolute", top: 8, right: 8 }}>
                    <TooltipProvider>
                        <UITooltip>
                            <TooltipTrigger asChild>
                                <div style={{ padding: 4, cursor: "help" }}>
                                    <Info style={{ width: 14, height: 14, color: "var(--label-tertiary)" }} />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[250px] apple-dialog" style={{ padding: 12, fontSize: 11, color: "var(--label-primary)" }}>
                                <p style={{ color: "var(--label-secondary)", lineHeight: 1.5 }}>{info}</p>
                            </TooltipContent>
                        </UITooltip>
                    </TooltipProvider>
                </div>
            )}
            <div style={{ width: 32, height: 32, borderRadius: "var(--radius-md)", background: `color-mix(in srgb, ${color} 12%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon style={{ width: 14, height: 14, color: color }} />
            </div>
            <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: "var(--label-tertiary)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{title}</p>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: "var(--label-primary)", letterSpacing: "var(--ls-metric)", lineHeight: 1.1 }}>{value}</h3>
            </div>
        </div>
    );
}
