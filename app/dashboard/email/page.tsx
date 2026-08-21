"use client";

import { Mail, Send, Inbox, UserMinus, AlertCircle } from "lucide-react";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useRouter } from "next/navigation";
import { subDays } from "date-fns";
import { useData } from "@/context/DataContext";
import { WorldWideLoader } from "@/components/world-wide-loader";

/* ── Apple Metric Tile ── */
function MetricTile({ title, subtitle, value, accentColor, icon, onClick }: {
    title: string; subtitle?: string; value: string | number;
    accentColor: string; icon: React.ReactNode; onClick?: () => void;
}) {
    return (
        <div
            className="metric-tile"
            style={{ '--tile-accent': accentColor, cursor: onClick ? 'pointer' : 'default' } as any}
            onClick={onClick}
            onMouseEnter={e => { if (onClick) e.currentTarget.style.transform = 'translateY(-2px) scale(1.002)'; }}
            onMouseLeave={e => { if (onClick) e.currentTarget.style.transform = ''; }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ flex: 1 }}>
                    <div className="tile-label">{title}</div>
                    <div className="tile-value tabular-nums" style={{ fontSize: 30 }}>{value}</div>
                    {subtitle && (
                        <div className="tile-trend neutral">{subtitle}</div>
                    )}
                </div>
                <div style={{
                    width: 38, height: 38, borderRadius: 10,
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

/* ── Breakdown Card with mini donut ── */
function BreakdownCard({ title, count, total, accentColor }: {
    title: string; count: number; total: number; accentColor: string;
}) {
    const pct = total > 0 ? parseFloat(((count / total) * 100).toFixed(1)) : 0;
    const data = [{ value: pct }, { value: 100 - pct }];

    return (
        <div className="liquid-card" style={{ padding: '20px 20px 24px', textAlign: 'center' }}>
            <div style={{ height: 110, position: 'relative', marginBottom: 4 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data} cx="50%" cy="50%"
                            innerRadius={30} outerRadius={45}
                            startAngle={90} endAngle={-270}
                            dataKey="value" stroke="none"
                        >
                            <Cell fill={accentColor} />
                            <Cell fill={`${accentColor}14`} />
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--label-primary)' }}>
                        {pct}%
                    </span>
                </div>
            </div>

            <div style={{ fontSize: 26, fontWeight: 300, letterSpacing: '-0.03em', color: 'var(--label-primary)', fontVariantNumeric: 'tabular-nums', marginBottom: 4 }}>
                {count.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: accentColor }}>
                {title}
            </div>
            <div style={{ fontSize: 11, color: 'var(--label-tertiary)', marginTop: 2 }}>Emails Sent</div>
        </div>
    );
}

export default function EmailDashboardPage() {
    const router = useRouter();
    const [selectedLoopMetric, setSelectedLoopMetric] = useState("intro");
    const [dateSubtitle, setDateSubtitle] = useState("Last 7 days");
    const { leads: allLeads, loadingLeads } = useData();

    const [dateRange, setDateRange] = useState<any>({
        from: subDays(new Date(), 7),
        to: new Date(),
    });

    const data = useMemo(() => {
        if (loadingLeads) return {
            totalEmails: 0, introEmails: 0, followUpEmails: 0, nurtureEmails: 0,
            totalReplies: 0, totalBounced: 0, totalUnsubscribed: 0,
            introCounts: [0, 0, 0], followUpCounts: [0, 0, 0], nurtureCounts: [0, 0, 0, 0, 0, 0, 0, 0, 0],
            loopTotals: { intro: 0, followup: 0, nurture: 0 },
        };

        const fromD = dateRange?.from ? new Date(dateRange.from) : null;
        const toD = dateRange?.to ? new Date(dateRange.to) : fromD;
        if (fromD) fromD.setHours(0, 0, 0, 0);
        if (toD) toD.setHours(23, 59, 59, 999);
        const inRange = (d: Date | null) => { if (!fromD || !toD) return true; if (!d) return false; return d >= fromD && d <= toD; };

        let totalEmails = 0, introEmails = 0, followUpEmails = 0, nurtureEmails = 0;
        let replyCount = 0, bounceCount = 0, unsubCount = 0;
        const intro = [0, 0, 0];
        const followUp = [0, 0, 0];
        const nurture = [0, 0, 0, 0, 0, 0, 0, 0, 0];

        allLeads.forEach((lead: any) => {
            const loop = (lead.source_loop || "").toLowerCase();
            const isIntro = loop === 'nr_wf' || loop === 'intro';
            const isNurture = loop === 'nurture';
            const isFollowUp = loop === 'followup' || loop.includes('follow');

            // Count emails sent: try Email X_TS columns first, fallback to stages_passed
            if (isIntro || isFollowUp) {
                let countedAny = false;
                const emailTimestamps = [
                    { ts: lead.email_1_ts, stage: 'Email_1', idx: 0 },
                    { ts: lead.email_2_ts, stage: 'Email_2', idx: 1 },
                    { ts: lead.email_3_ts, stage: 'Email_3', idx: 2 },
                ];
                emailTimestamps.forEach(({ ts, stage, idx }) => {
                    if (ts) {
                        const emailDate = new Date(ts);
                        if (inRange(emailDate)) {
                            totalEmails++;
                            countedAny = true;
                            if (isIntro) { intro[idx]++; introEmails++; }
                            else { followUp[idx]++; followUpEmails++; }
                        }
                    }
                });
                // Fallback: if no TS columns but stages_passed has email stages, count them
                if (!countedAny) {
                    const stages = lead.stages_passed || [];
                    const fallbackDate = lead.email_sent_at || lead.updated_at || lead.created_at;
                    stages.forEach((stage: string) => {
                        const s = stage.toLowerCase().trim();
                        if (s.startsWith('email_')) {
                            const idx = parseInt(s.split('_')[1]) - 1;
                            if (idx >= 0 && idx < 3 && inRange(new Date(fallbackDate))) {
                                totalEmails++;
                                if (isIntro) { intro[idx]++; introEmails++; }
                                else { followUp[idx]++; followUpEmails++; }
                            }
                        }
                    });
                }
            } else if (isNurture) {
                // Nurture has no Email X_TS columns — count from stages_passed
                const stages = lead.stages_passed || [];
                const fallbackDate = lead.email_sent_at || lead.updated_at || lead.created_at;
                stages.forEach((stage: string) => {
                    const s = stage.toLowerCase().trim();
                    if (s.startsWith('email_')) {
                        const idx = parseInt(s.split('_')[1]) - 1;
                        if (idx >= 0 && idx < 9) {
                            if (inRange(new Date(fallbackDate))) {
                                nurture[idx]++;
                                totalEmails++;
                                nurtureEmails++;
                            }
                        }
                    }
                });
            }

            // Email replies - prefer user_email_replied from nr_wf
            const emailReply = lead.user_email_replied || lead.email_replied;
            if (emailReply && !["no", "none", ""].includes(String(emailReply).toLowerCase().trim())) {
                const rDate = lead.email_replied_ts ? new Date(lead.email_replied_ts) : null;
                if (inRange(rDate)) replyCount++;
            }

            // Bounced
            if (lead.email_bounced === true || lead.email_bounced === "true") bounceCount++;

            // Unsubscribed
            if (lead.unsubscribed && String(lead.unsubscribed).toLowerCase().includes("yes")) unsubCount++;
        });

        return {
            totalEmails, introEmails, followUpEmails, nurtureEmails,
            totalReplies: replyCount, totalBounced: bounceCount, totalUnsubscribed: unsubCount,
            introCounts: intro, followUpCounts: followUp, nurtureCounts: nurture,
            loopTotals: {
                intro: intro.reduce((a, b) => a + b, 0),
                followup: followUp.reduce((a, b) => a + b, 0),
                nurture: nurture.reduce((a, b) => a + b, 0),
            },
        };
    }, [dateRange, allLeads, loadingLeads]);

    const loopOptions = {
        intro:   { value: data.loopTotals.intro,   label: "Intro Loop",    color: 'var(--blue)'   },
        followup:{ value: data.loopTotals.followup, label: "Follow-up Loop",color: 'var(--orange)' },
        nurture: { value: data.loopTotals.nurture,  label: "Nurture Loop",  color: 'var(--purple)' },
    };
    const currentLoop = loopOptions[selectedLoopMetric as keyof typeof loopOptions];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40, position: 'relative', minHeight: 500 }}>
            {loadingLeads && <WorldWideLoader />}

            {/* Header */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.022em', color: 'var(--label-primary)', marginBottom: 4 }}>
                        Email Marketing
                    </h1>
                    <p style={{ fontSize: 14, color: 'var(--label-secondary)' }}>
                        Monitor your campaigns and inbox health
                    </p>
                </div>
                <DateRangePicker onUpdate={r => {
                    setDateRange(r.range);
                    setDateSubtitle(r.label ? `${r.label.toLowerCase()}` : 'selected range');
                }} />
            </div>

            {/* Top Metric Tiles */}
            <div className="metric-grid-sm">
                <MetricTile
                    title="Total Emails"
                    subtitle={dateSubtitle}
                    value={data.totalEmails.toLocaleString()}
                    accentColor="var(--indigo)"
                    icon={<Mail size={17} />}
                    onClick={() => router.push('/dashboard/email/sent')}
                />
                <MetricTile
                    title="Total Replies"
                    subtitle={dateSubtitle}
                    value={data.totalReplies.toLocaleString()}
                    accentColor="var(--teal)"
                    icon={<Inbox size={17} />}
                    onClick={() => router.push('/dashboard/email/received')}
                />
                <MetricTile
                    title="Bounced"
                    subtitle="All time"
                    value={data.totalBounced.toLocaleString()}
                    accentColor="var(--red)"
                    icon={<AlertCircle size={17} />}
                    onClick={() => router.push('/dashboard/email/bounces')}
                />
                <MetricTile
                    title="Unsubscribed"
                    subtitle="All time"
                    value={data.totalUnsubscribed.toLocaleString()}
                    accentColor="var(--orange)"
                    icon={<UserMinus size={17} />}
                    onClick={() => router.push('/dashboard/email/unsubscribed')}
                />
            </div>

            {/* Campaign Breakdown Tabs */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h2 style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.022em', color: 'var(--label-primary)' }}>
                        Campaign Performance
                    </h2>
                </div>

                <Tabs defaultValue="intro">
                    <TabsList style={{ marginBottom: 20 }}>
                        <TabsTrigger value="intro">Sequence 1</TabsTrigger>
                        <TabsTrigger value="followup">Sequence 2</TabsTrigger>
                        <TabsTrigger value="nurture">Sequence 3</TabsTrigger>
                    </TabsList>

                    <TabsContent value="intro">
                        <div className="metric-grid-sm">
                            {["Email 1", "Email 2", "Email 3"].map((name, i) => (
                                <BreakdownCard key={name} title={name} count={data.introCounts[i]} total={data.totalEmails} accentColor="var(--blue)" />
                            ))}
                        </div>
                    </TabsContent>

                    <TabsContent value="followup">
                        <div className="metric-grid-sm">
                            {["Email 1", "Email 2", "Email 3"].map((name, i) => (
                                <BreakdownCard key={name} title={name} count={data.followUpCounts[i]} total={data.totalEmails} accentColor="var(--orange)" />
                            ))}
                        </div>
                    </TabsContent>

                    <TabsContent value="nurture">
                        <div className="metric-grid-sm">
                            {Array.from({ length: 9 }).map((_, i) => (
                                <BreakdownCard key={i} title={`Email ${i + 1}`} count={data.nurtureCounts[i]} total={data.totalEmails} accentColor="var(--purple)" />
                            ))}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
