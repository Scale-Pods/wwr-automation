"use client";

import { Send, CheckCheck, Clock, XCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useState, useEffect, useMemo } from "react";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { WorldWideLoader } from "@/components/world-wide-loader";
import { coerceTimestamp } from "@/lib/outreach-types";

type Row = {
    id: string;
    recipient: string;
    phone: string;
    message: string;
    status: "Sent" | "Delivered" | "Read" | "Failed";
    time: string;
    rawDate: number | null;
};

export default function WhatsappSentPage() {
    const [dateRange, setDateRange] = useState<any>({ from: subDays(new Date(), 7), to: new Date() });
    const [leads, setLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        if (!dateRange?.from) return;
        setLoading(true);
        fetch(`/api/whatsapp-leads`)
            .then(r => (r.ok ? r.json() : { leads: [] }))
            .then(d => setLeads(d.leads || d.nr_wf || []))
            .catch(() => setLeads([]))
            .finally(() => setLoading(false));
    }, [dateRange]);

    const { rows, stats } = useMemo(() => {
        const from = dateRange?.from ? startOfDay(new Date(dateRange.from)).getTime() : null;
        const to = endOfDay(new Date(dateRange?.to || dateRange?.from || new Date())).getTime();
        const inRange = (t: number | null) => !from || (t != null && t >= from && t <= to);

        const out: Row[] = [];
        let delivered = 0, read = 0, failed = 0, sent = 0;

        leads.forEach(lead => {
            const name = lead.full_name || [lead.first_name, lead.last_name].filter(Boolean).join(" ") || lead.phone || "Unknown";
            for (let n = 1; n <= 4; n++) {
                const message = lead[`wa_${n}`];
                const status = lead[`wa_${n}_status`];
                const sentAtRaw = lead[`wa_${n}_sent_at`];
                if (!message && !status && !sentAtRaw) continue;

                const iso = coerceTimestamp(sentAtRaw) || coerceTimestamp(lead.wa_1_sent_at) || lead.created_at || null;
                const t = iso ? new Date(iso).getTime() : null;
                if (!inRange(t)) continue;

                const s = String(status || "").toLowerCase();
                let label: Row["status"] = "Sent";
                if (s.includes("read")) { label = "Read"; read++; }
                else if (s.includes("deliver")) { label = "Delivered"; delivered++; }
                else if (s.includes("fail")) { label = "Failed"; failed++; }
                else { label = "Sent"; sent++; }

                out.push({
                    id: `${lead.lead_id || lead.crm_id}-wa-${n}`,
                    recipient: name,
                    phone: lead.phone || "",
                    message: message ? String(message) : `WhatsApp message ${n}`,
                    status: label,
                    time: t ? new Date(t).toLocaleString([], { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—",
                    rawDate: t,
                });
            }
        });

        out.sort((a, b) => (b.rawDate || 0) - (a.rawDate || 0));
        return { rows: out, stats: { total: out.length, delivered, read, failed, sent } };
    }, [leads, dateRange]);

    const filtered = rows.filter(r =>
        r.recipient.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.phone.includes(searchQuery) ||
        r.message.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-5 pb-10 relative min-h-[500px]">
            {loading && <WorldWideLoader />}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "var(--ls-heading)", color: "var(--label-primary)" }}>Sent WhatsApp Messages</h1>
                    <p style={{ fontSize: 13, color: "var(--label-secondary)", marginTop: 2 }}>History of all outbound WhatsApp communications</p>
                </div>
                <DateRangePicker onUpdate={(val) => setDateRange(val.range)} />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard title="Total Sent" value={loading ? "…" : stats.total.toLocaleString()} icon={Send} color="var(--blue)" />
                <StatCard title="Delivered" value={loading ? "…" : stats.delivered.toLocaleString()} icon={CheckCheck} color="var(--green)" />
                <StatCard title="Read" value={loading ? "…" : stats.read.toLocaleString()} icon={CheckCheck} color="var(--purple)" />
                <StatCard title="Failed" value={loading ? "…" : stats.failed.toLocaleString()} icon={XCircle} color="var(--red)" />
            </div>

            <div style={{ position: "relative" }}>
                <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--label-tertiary)" }} />
                <Input className="pl-10" style={{ background: "var(--fill-tertiary)", border: "1px solid var(--glass-border)", color: "var(--label-primary)", borderRadius: "var(--radius-lg)" }} placeholder="Search recipient, phone, or message…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>

            <div className="liquid-card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--hairline)", background: "var(--fill-quaternary)" }}>
                    <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--label-primary)" }}>Message History</h2>
                </div>
                <div style={{ position: "relative", minHeight: 200 }}>
                    {!loading && filtered.length === 0 ? (
                        <div style={{ padding: "48px 16px", textAlign: "center", color: "var(--label-tertiary)", fontSize: 13 }}>No messages found for this range.</div>
                    ) : (
                        <div className="divide-y" style={{ borderColor: "var(--hairline)" }}>
                            {filtered.map(msg => (
                                <div key={msg.id} style={{ padding: "12px 16px", display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 10, borderBottom: "1px solid var(--hairline)" }}>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--label-primary)" }}>{msg.recipient}</span>
                                            {msg.phone && <span style={{ fontSize: 11, color: "var(--label-tertiary)", fontFamily: "ui-monospace, monospace" }}>{msg.phone}</span>}
                                        </div>
                                        <p style={{ fontSize: 12, color: "var(--label-secondary)", marginTop: 3, whiteSpace: "pre-wrap", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{msg.message}</p>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                                        <StatusPill status={msg.status} />
                                        <span style={{ fontSize: 10, color: "var(--label-tertiary)" }}>{msg.time}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon: Icon, color }: any) {
    return (
        <div className="liquid-card" style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "var(--radius-md)", background: `color-mix(in srgb, ${color} 12%, transparent)`, color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon style={{ width: 14, height: 14 }} />
            </div>
            <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: "var(--label-tertiary)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{title}</p>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: "var(--label-primary)", letterSpacing: "var(--ls-metric)", lineHeight: 1.1 }}>{value}</h3>
            </div>
        </div>
    );
}

function StatusPill({ status }: { status: "Sent" | "Delivered" | "Read" | "Failed" }) {
    const map = {
        Sent: { bg: "var(--fill-secondary)", color: "var(--label-tertiary)", Icon: Clock },
        Delivered: { bg: "rgba(48,209,88,0.12)", color: "var(--green)", Icon: CheckCheck },
        Read: { bg: "rgba(10,132,255,0.12)", color: "var(--blue)", Icon: CheckCheck },
        Failed: { bg: "rgba(255,69,58,0.12)", color: "var(--red)", Icon: XCircle },
    }[status];
    const { Icon } = map;
    return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: "var(--radius-sm)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", background: map.bg, color: map.color }}>
            <Icon style={{ width: 10, height: 10 }} /> {status}
        </span>
    );
}
