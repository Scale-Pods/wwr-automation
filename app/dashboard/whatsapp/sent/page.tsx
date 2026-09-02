"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, CheckCheck, Clock, XCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useState, useEffect } from "react";
import { subDays } from "date-fns";
import { WorldWideLoader } from "@/components/world-wide-loader";
import { useData } from "@/context/DataContext";
import { coerceTimestamp } from "@/lib/outreach-types";
import type { OutreachLead } from "@/lib/outreach-types";

export default function WhatsappSentPage() {
    const { leads: allLeads, loadingLeads } = useData();
    const [dateRange, setDateRange] = useState<any>({ from: subDays(new Date(), 7), to: new Date() });
    const [messages, setMessages] = useState<any[]>([]);
    const loading = loadingLeads;
    const [searchQuery, setSearchQuery] = useState("");
    const [stats, setStats] = useState({ total: 0, delivered: 0, read: 0, failed: 0 });

    useEffect(() => {
        if (loadingLeads) return;

        const from = dateRange?.from ? new Date(dateRange.from) : null;
        const to = dateRange?.to ? new Date(dateRange.to) : from;
        if (from) from.setHours(0, 0, 0, 0);
        if (to) to.setHours(23, 59, 59, 999);
        const inRange = (d: Date | null) => { if (!from || !to) return true; if (!d) return false; return d >= from && d <= to; };

        const rows: any[] = [];
        let delivered = 0, read = 0, failed = 0;

        (allLeads as OutreachLead[]).forEach(lead => {
            lead.wa_slots.forEach(slot => {
                if (!slot.message && !slot.sent_at && !slot.status) return;
                const ts = coerceTimestamp(slot.sent_at) || lead.created_at || null;
                if (!inRange(ts ? new Date(ts) : null)) return;

                const statusRaw = String(slot.status || "").toLowerCase();
                let status = "Sent";
                if (statusRaw.includes("read")) { status = "Read"; read++; }
                else if (statusRaw.includes("deliver")) { status = "Delivered"; delivered++; }
                else if (statusRaw.includes("fail")) { status = "Failed"; failed++; }
                else { delivered++; }

                rows.push({
                    id: `${lead.lead_id}-wa-${slot.n}`,
                    recipient: lead.name || lead.phone || "Unknown",
                    message: slot.message || `WhatsApp message ${slot.n}`,
                    status,
                    time: ts ? new Date(ts).toLocaleString() : "Unknown",
                    rawDate: ts,
                });
            });
        });

        rows.sort((a, b) => new Date(b.rawDate || 0).getTime() - new Date(a.rawDate || 0).getTime());
        setMessages(rows);
        setStats({ total: rows.length, delivered, read, failed });
    }, [dateRange, allLeads, loadingLeads]);

    const filteredMessages = messages.filter(msg =>
        msg.recipient.toLowerCase().includes(searchQuery.toLowerCase()) ||
        msg.message.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) return <WorldWideLoader />;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Total Sent Messages</h1>
                    <p className="text-slate-500">History of all outbound WhatsApp communications</p>
                </div>
                <DateRangePicker onUpdate={(val) => setDateRange(val.range)} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard title="Total Sent" value={stats.total.toLocaleString()} icon={<Send className="h-4 w-4" />} color="text-blue-600" bg="bg-blue-50" />
                <StatCard title="Delivered" value={stats.delivered.toLocaleString()} icon={<CheckCheck className="h-4 w-4" />} color="text-emerald-600" bg="bg-emerald-50" />
                <StatCard title="Read" value={stats.read.toLocaleString()} icon={<CheckCheck className="h-4 w-4 text-blue-500" />} color="text-amber-600" bg="bg-amber-50" />
                <StatCard title="Failed" value={stats.failed.toLocaleString()} icon={<XCircle className="h-4 w-4" />} color="text-rose-600" bg="bg-rose-50" />
            </div>

            <Card className="border-slate-200">
                <CardHeader className="border-b border-slate-100 flex flex-row items-center justify-between py-4">
                    <CardTitle className="text-lg">Message History</CardTitle>
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input className="pl-10 h-9" placeholder="Search recipients..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    </div>
                </CardHeader>
                <CardContent className="p-0 relative min-h-[300px]">
                    <div className="divide-y divide-slate-100">
                        {filteredMessages.length > 0 ? filteredMessages.map(msg => (
                            <div key={msg.id} className="p-4 hover:bg-slate-50 transition-colors flex items-start justify-between">
                                <div className="space-y-1">
                                    <p className="font-bold text-slate-950">{msg.recipient}</p>
                                    <p className="text-sm text-slate-600 max-w-xl">{msg.message}</p>
                                    <div className="flex items-center gap-3 mt-2">
                                        <span className="text-[10px] text-slate-400 uppercase font-bold">{msg.time}</span>
                                        <span className={`flex items-center gap-1 text-[10px] font-bold uppercase ${msg.status === "Read" ? "text-blue-500" : msg.status === "Delivered" ? "text-emerald-500" : msg.status === "Failed" ? "text-rose-500" : "text-slate-400"}`}>
                                            {(msg.status === "Read" || msg.status === "Delivered") && <CheckCheck className="h-3 w-3" />}
                                            {msg.status === "Sent" && <Clock className="h-3 w-3" />}
                                            {msg.status === "Failed" && <XCircle className="h-3 w-3" />}
                                            {msg.status}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="p-12 text-center text-slate-400">No messages found.</div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function StatCard({ title, value, icon, color, bg }: any) {
    return (
        <Card className="border-slate-200">
            <CardContent className="p-4 flex items-center gap-4">
                <div className={`p-3 rounded-lg ${bg} ${color}`}>{icon}</div>
                <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
                    <p className="text-xl font-bold text-slate-900">{value}</p>
                </div>
            </CardContent>
        </Card>
    );
}
