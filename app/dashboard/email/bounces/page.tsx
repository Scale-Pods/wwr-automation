"use client";

import { WorldWideLoader } from "@/components/world-wide-loader";
import { Input } from "@/components/ui/input";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Mail, Search, Calendar } from "lucide-react";
import { useState, useMemo } from "react";
import { useData } from "@/context/DataContext";
import { subDays } from "date-fns";
import { coerceTimestamp } from "@/lib/outreach-types";
import type { OutreachLead } from "@/lib/outreach-types";
import { EmailBoardFilter } from "@/components/dashboard/email-board-filter";
import { boardOf, boardLabel, matchesBoard, type EmailBoardKey } from "@/lib/email-board";

function isBounceStatus(s: any): boolean {
    const v = String(s || "").toLowerCase();
    return v.includes("bounce") || v.includes("fail") || v.includes("invalid") || v.includes("rejected");
}

export default function BouncedEmailsPage() {
    const { leads: allLeads, loadingLeads } = useData();
    const loading = loadingLeads;

    const [searchTerm, setSearchTerm] = useState("");
    const [dateRange, setDateRange] = useState<any>({ from: subDays(new Date(), 30), to: new Date() });
    const [board, setBoard] = useState<EmailBoardKey>("all");

    const bouncedLeads = useMemo(() => {
        if (loadingLeads) return [];
        return (allLeads as OutreachLead[])
            .filter(lead => matchesBoard(lead, board))
            .map(lead => {
                const bad = lead.email_slots.find(s => isBounceStatus(s.status));
                if (!bad) return null;
                const bounceDate = coerceTimestamp(bad.sent_at) || lead.last_activity || lead.updated_at || lead.created_at || null;
                return { lead, bounceDate, step: bad.n, board: boardOf(lead) };
            })
            .filter((x): x is NonNullable<typeof x> => !!x)
            .filter(({ bounceDate }) => {
                if (!dateRange?.from) return true;
                const d = bounceDate ? new Date(bounceDate) : null;
                if (!d || isNaN(d.getTime())) return true;
                const from = new Date(dateRange.from); from.setHours(0, 0, 0, 0);
                const to = dateRange.to ? new Date(dateRange.to) : new Date(from); to.setHours(23, 59, 59, 999);
                return d >= from && d <= to;
            })
            .sort((a, b) => new Date(b.bounceDate || 0).getTime() - new Date(a.bounceDate || 0).getTime());
    }, [allLeads, loadingLeads, dateRange, board]);

    const filtered = bouncedLeads.filter(({ lead }) =>
        lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-5 pb-10 relative min-h-[500px]">
            {loading && <WorldWideLoader />}

            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "var(--ls-heading)", color: "var(--label-primary)" }}>Bounced Emails</h1>
                    <p style={{ fontSize: 13, color: "var(--label-secondary)", marginTop: 2 }}>Leads with a bounced or failed email send</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <EmailBoardFilter value={board} onChange={setBoard} />
                    <DateRangePicker onUpdate={(range: any) => setDateRange(range.range)} />
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
                <StatCard title="Total Bounced" value={bouncedLeads.length.toString()} color="var(--red)" />
                <StatCard title="Bounce Rate" value={allLeads.length > 0 ? `${((bouncedLeads.length / allLeads.length) * 100).toFixed(1)}%` : "0%"} color="var(--orange)" />
                <StatCard title="In Date Range" value={filtered.length.toString()} color="var(--label-primary)" />
            </div>

            <div className="liquid-card" style={{ padding: "12px 14px" }}>
                <div style={{ position: "relative" }}>
                    <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "var(--label-tertiary)" }} />
                    <Input style={{ paddingLeft: 30, height: 36, background: "var(--fill-tertiary)", border: "1px solid var(--glass-border)", color: "var(--label-primary)", fontSize: 12, borderRadius: "var(--radius-md)" }} placeholder="Search by name or email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
            </div>

            <div className="liquid-card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ position: "relative", minHeight: 200 }}>
                    {loading ? <WorldWideLoader fullScreen={false} /> : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead style={{ borderBottom: "1px solid var(--hairline)" }}>
                                    <tr style={{ background: "var(--fill-quaternary)" }}>
                                        {["Name", "Board", "Email", "Bounced Step", "Bounce Date", "Status"].map(h => (
                                            <th key={h} style={{ padding: "10px 16px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--label-tertiary)" }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length > 0 ? filtered.map(({ lead, bounceDate, step, board: b }, idx) => (
                                        <tr key={lead.lead_id || idx} style={{ borderBottom: "1px solid var(--hairline)", transition: "background 120ms" }}
                                            onMouseEnter={e => (e.currentTarget.style.background = "var(--fill-quaternary)")}
                                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                                            <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "var(--label-primary)" }}>{lead.name || "N/A"}</td>
                                            <td style={{ padding: "12px 16px", fontSize: 11 }}>
                                                <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: "var(--radius-sm)", fontSize: 10, fontWeight: 700, background: "rgba(10,132,255,0.10)", color: "var(--blue)" }}>{boardLabel(b as EmailBoardKey)}</span>
                                            </td>
                                            <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--label-secondary)" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                    <Mail style={{ width: 12, height: 12, color: "var(--label-tertiary)", flexShrink: 0 }} />
                                                    {lead.email || "N/A"}
                                                </div>
                                            </td>
                                            <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--label-secondary)" }}>Email {step}</td>
                                            <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--label-secondary)" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                    <Calendar style={{ width: 12, height: 12, color: "var(--label-tertiary)", flexShrink: 0 }} />
                                                    {bounceDate ? new Date(bounceDate).toLocaleDateString() : "N/A"}
                                                </div>
                                            </td>
                                            <td style={{ padding: "12px 16px" }}>
                                                <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 8px", borderRadius: "var(--radius-sm)", fontSize: 10, fontWeight: 700, background: "rgba(255,69,58,0.10)", color: "var(--red)" }}>Bounced</span>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={6} style={{ padding: "60px 16px", textAlign: "center", fontSize: 13, color: "var(--label-tertiary)" }}>{loading ? "Loading..." : "No bounced emails found."}</td></tr>
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
        <div className="liquid-card" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--label-tertiary)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{title}</span>
            <span style={{ fontSize: 24, fontWeight: 700, color, letterSpacing: "var(--ls-metric)" }}>{value}</span>
        </div>
    );
}
