"use client";

import { WorldWideLoader } from "@/components/world-wide-loader";
import { useState, useMemo } from "react";
import { subDays } from "date-fns";
import { useData } from "@/context/DataContext";
import { UserMinus, Search, Mail, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { OutreachLead } from "@/lib/outreach-types";
import { EmailBoardFilter } from "@/components/dashboard/email-board-filter";
import { boardOf, boardLabel, matchesBoard, type EmailBoardKey } from "@/lib/email-board";

function isUnsubscribed(lead: OutreachLead): boolean {
    if (String(lead.raw?.sync_status || "").toLowerCase().includes("unsub")) return true;
    if (lead.email_slots.some(s => String(s.status || "").toLowerCase().includes("unsub"))) return true;
    const t = String(lead.email_reply_track || "").toLowerCase();
    if (t.includes("unsubscrib") || t.includes("opt out") || t.includes("opt-out")) return true;
    const note = String(lead.email_note || "").toLowerCase();
    return note.includes("unsubscrib");
}

export default function UnsubscribedPage() {
    const { leads: allLeads, loadingLeads } = useData();
    const loading = loadingLeads;

    const [searchTerm, setSearchTerm] = useState("");
    const [dateRange, setDateRange] = useState<any>({ from: subDays(new Date(), 30), to: new Date() });
    const [repliedFilter, setRepliedFilter] = useState("all");
    const [board, setBoard] = useState<EmailBoardKey>("all");

    const unsubscribedLeads = useMemo(() => {
        if (loadingLeads) return [];
        return (allLeads as OutreachLead[]).filter(l => matchesBoard(l, board) && isUnsubscribed(l));
    }, [allLeads, loadingLeads, board]);

    const filteredLeads = useMemo(() => {
        return unsubscribedLeads.filter(l => {
            const matchesSearch = l.name?.toLowerCase().includes(searchTerm.toLowerCase()) || l.email?.toLowerCase().includes(searchTerm.toLowerCase());
            let matchesReplied = true;
            if (repliedFilter === "yes") matchesReplied = l.replied === "Yes";
            else if (repliedFilter === "no") matchesReplied = l.replied !== "Yes";
            let matchesDate = true;
            if (dateRange?.from) {
                const d = new Date(l.updated_at || l.last_activity || l.created_at || 0);
                const from = new Date(dateRange.from); from.setHours(0, 0, 0, 0);
                const to = dateRange.to ? new Date(dateRange.to) : new Date(from); to.setHours(23, 59, 59, 999);
                matchesDate = d >= from && d <= to;
            }
            return matchesSearch && matchesReplied && matchesDate;
        }).sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime());
    }, [unsubscribedLeads, searchTerm, dateRange, repliedFilter]);

    return (
        <div className="space-y-5 pb-10">
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "var(--ls-heading)", color: "var(--label-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                        <UserMinus style={{ width: 20, height: 20, color: "var(--red)" }} />
                        Unsubscribed Leads
                    </h1>
                    <p style={{ fontSize: 13, color: "var(--label-secondary)", marginTop: 2 }}>
                        {unsubscribedLeads.length} total · {filteredLeads.length} in date range
                    </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <EmailBoardFilter value={board} onChange={setBoard} />
                    <DateRangePicker onUpdate={(range: any) => setDateRange(range.range)} />
                </div>
            </div>

            <div className="liquid-card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--hairline)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                    <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
                        <Search style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "var(--label-tertiary)" }} />
                        <Input type="text" placeholder="Search name or email..." style={{ paddingLeft: 28, height: 34, background: "var(--fill-tertiary)", border: "1px solid var(--glass-border)", color: "var(--label-primary)", fontSize: 12, borderRadius: "var(--radius-md)" }} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <Select value={repliedFilter} onValueChange={setRepliedFilter}>
                        <SelectTrigger style={{ width: 135, height: 34, fontSize: 12 }}><SelectValue placeholder="Reply Status" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="yes">Replied</SelectItem>
                            <SelectItem value="no">No Reply</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div style={{ position: "relative", minHeight: 400 }}>
                    {loading ? <WorldWideLoader fullScreen={false} /> : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead style={{ borderBottom: "1px solid var(--hairline)" }}>
                                    <tr style={{ background: "var(--fill-quaternary)" }}>
                                        {["Name", "Board", "Email", "Stage", "Status", "Date"].map(h => (
                                            <th key={h} style={{ padding: "10px 16px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--label-tertiary)" }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLeads.length > 0 ? filteredLeads.map((lead, idx) => {
                                        const d = lead.updated_at ? new Date(lead.updated_at) : null;
                                        return (
                                            <tr key={lead.lead_id || idx} style={{ borderBottom: "1px solid var(--hairline)", transition: "background 120ms" }}
                                                onMouseEnter={e => (e.currentTarget.style.background = "var(--fill-quaternary)")}
                                                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                                                <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "var(--label-primary)" }}>{lead.name || "N/A"}</td>
                                                <td style={{ padding: "12px 16px", fontSize: 11 }}>
                                                    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: "var(--radius-sm)", fontSize: 10, fontWeight: 700, background: "rgba(10,132,255,0.10)", color: "var(--blue)" }}>{boardLabel(boardOf(lead))}</span>
                                                </td>
                                                <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--label-secondary)" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                        <Mail style={{ width: 12, height: 12, color: "var(--label-tertiary)", flexShrink: 0 }} />
                                                        {lead.email || "N/A"}
                                                    </div>
                                                </td>
                                                <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--label-secondary)" }}>{lead.lead_stage || "N/A"}</td>
                                                <td style={{ padding: "12px 16px" }}>
                                                    <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 8px", borderRadius: "var(--radius-sm)", fontSize: 10, fontWeight: 700, background: "rgba(255,69,58,0.10)", color: "var(--red)" }}>Unsubscribed</span>
                                                </td>
                                                <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--label-secondary)" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                        <Calendar style={{ width: 12, height: 12, color: "var(--label-tertiary)", flexShrink: 0 }} />
                                                        {d ? d.toLocaleDateString() : "N/A"}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    }) : (
                                        <tr><td colSpan={6} style={{ padding: "60px 16px", textAlign: "center", fontSize: 13, color: "var(--label-tertiary)" }}>{loading ? "Loading..." : "No unsubscribed leads found."}</td></tr>
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
