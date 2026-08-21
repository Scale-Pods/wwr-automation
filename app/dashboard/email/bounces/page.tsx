"use client";

import { WorldWideLoader } from "@/components/world-wide-loader";
import { Input } from "@/components/ui/input";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Mail, Search, Calendar, AlertCircle } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useData } from "@/context/DataContext";
import { subDays } from "date-fns";

export default function BouncedEmailsPage() {
    const { leads: allLeads, loadingLeads } = useData();
    const loading = loadingLeads;

    const [searchTerm, setSearchTerm] = useState("");
    const [dateRange, setDateRange] = useState<any>({ from: subDays(new Date(), 30), to: new Date() });

    const bouncedLeads = useMemo(() => {
        if (loadingLeads) return [];
        return allLeads.filter((lead: any) => {
            const isBounced = lead.email_bounced === true || lead.email_bounced === "true";
            if (!isBounced) return false;

            if (dateRange?.from && lead.email_bounced_ts) {
                const bounceDate = new Date(lead.email_bounced_ts);
                const from = new Date(dateRange.from); from.setHours(0, 0, 0, 0);
                const to = dateRange.to ? new Date(dateRange.to) : new Date(from); to.setHours(23, 59, 59, 999);
                return bounceDate >= from && bounceDate <= to;
            }
            if (dateRange?.from && !lead.email_bounced_ts) {
                const leadDate = new Date(lead.updated_at || lead.created_at);
                const from = new Date(dateRange.from); from.setHours(0, 0, 0, 0);
                const to = dateRange.to ? new Date(dateRange.to) : new Date(from); to.setHours(23, 59, 59, 999);
                return leadDate >= from && leadDate <= to;
            }
            return true;
        }).sort((a: any, b: any) => {
            const dateA = a.email_bounced_ts ? new Date(a.email_bounced_ts).getTime() : 0;
            const dateB = b.email_bounced_ts ? new Date(b.email_bounced_ts).getTime() : 0;
            return dateB - dateA;
        });
    }, [allLeads, loadingLeads, dateRange]);

    const filteredLeads = bouncedLeads.filter((lead: any) => {
        const matchesSearch = lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            lead.email?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    return (
        <div className="space-y-5 pb-10 relative min-h-[500px]">
            {loading && <WorldWideLoader />}

            {/* Header */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: 'var(--ls-heading)', color: 'var(--label-primary)' }}>Bounced Emails</h1>
                    <p style={{ fontSize: 13, color: 'var(--label-secondary)', marginTop: 2 }}>Leads with bounced emails</p>
                </div>
                <DateRangePicker onUpdate={(range: any) => setDateRange(range.range)} />
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-3">
                <StatCard title="Total Bounced" value={bouncedLeads.length.toString()} color="var(--red)" />
                <StatCard
                    title="Bounce Rate"
                    value={allLeads.length > 0 ? `${((bouncedLeads.length / allLeads.length) * 100).toFixed(1)}%` : '0%'}
                    color="var(--orange)"
                />
                <StatCard title="In Date Range" value={filteredLeads.length.toString()} color="var(--label-primary)" />
            </div>

            {/* Search */}
            <div className="liquid-card" style={{ padding: '12px 14px' }}>
                <div style={{ position: 'relative' }}>
                    <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: 'var(--label-tertiary)' }} />
                    <Input
                        style={{ paddingLeft: 30, height: 36, background: 'var(--fill-tertiary)', border: '1px solid var(--glass-border)', color: 'var(--label-primary)', fontSize: 12, borderRadius: 'var(--radius-md)' }}
                        placeholder="Search by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Bounce List */}
            <div className="liquid-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ position: 'relative', minHeight: 200 }}>
                    {loading ? (
                        <WorldWideLoader fullScreen={false} />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead style={{ borderBottom: '1px solid var(--hairline)' }}>
                                    <tr style={{ background: 'var(--fill-quaternary)' }}>
                                        {['Name', 'Email', 'Source Loop', 'Bounce Date', 'Status'].map(h => (
                                            <th key={h} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--label-tertiary)' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLeads.length > 0 ? (
                                        filteredLeads.map((lead: any, idx: number) => {
                                            const bounceDate = lead.email_bounced_ts ? new Date(lead.email_bounced_ts) : null;
                                            return (
                                                <tr
                                                    key={lead.id || idx}
                                                    style={{ borderBottom: '1px solid var(--hairline)', transition: 'background 120ms' }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--fill-quaternary)')}
                                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                                >
                                                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--label-primary)' }}>{lead.name || "N/A"}</td>
                                                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--label-secondary)' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <Mail style={{ width: 12, height: 12, color: 'var(--label-tertiary)', flexShrink: 0 }} />
                                                            {lead.email || "N/A"}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--label-secondary)', textTransform: 'capitalize' }}>{lead.source_loop || "N/A"}</td>
                                                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--label-secondary)' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <Calendar style={{ width: 12, height: 12, color: 'var(--label-tertiary)', flexShrink: 0 }} />
                                                            {bounceDate ? bounceDate.toLocaleDateString() : 'N/A'}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 'var(--radius-sm)', fontSize: 10, fontWeight: 700, background: 'rgba(255,69,58,0.10)', color: 'var(--red)' }}>
                                                            Bounced
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={5} style={{ padding: '60px 16px', textAlign: 'center', fontSize: 13, color: 'var(--label-tertiary)' }}>
                                                {loading ? 'Loading...' : 'No bounced emails found.'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, color }: { title: string; value: string; color: string }) {
    return (
        <div className="liquid-card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--label-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{title}</span>
            <span style={{ fontSize: 24, fontWeight: 700, color, letterSpacing: 'var(--ls-metric)' }}>{value}</span>
        </div>
    );
}
