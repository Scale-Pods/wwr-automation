"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { WhatsAppChatDetail } from "@/components/dashboard/whatsapp-chat-detail";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Filter, Users, Send, MessageSquare, RefreshCw, ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { WorldWideLoader } from "@/components/world-wide-loader";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { isReplyTrackPositive, coerceTimestamp, parseJsonArray } from "@/lib/outreach-types";

// ── one lead's WhatsApp signals from outreach_table ──────────────────────────
function waSignals(lead: any) {
    const conv = parseJsonArray(lead.whatsapp_conversation);
    const slotMsgs: { n: number; message: string | null; status: string | null; sent_at: string | null }[] = [];
    for (let n = 1; n <= 4; n++) {
        const message = lead[`wa_${n}`] ?? null;
        const status = lead[`wa_${n}_status`] ?? null;
        const sent_at = lead[`wa_${n}_sent_at`] ?? null;
        if (message || status || sent_at) slotMsgs.push({ n, message, status, sent_at });
    }
    const botCount = conv.length
        ? conv.filter((m: any) => { const r = m?.role || m?.type || m?.sender; return r === "assistant" || r === "bot" || r === "agent"; }).length
        : slotMsgs.length;
    const replied = isReplyTrackPositive(lead.whatsapp_reply_track) ||
        conv.some((m: any) => { const r = m?.role || m?.type || m?.sender; return r === "user" || r === "User" || r === "customer"; });
    const failedCount = slotMsgs.filter(s => String(s.status || "").toLowerCase().includes("fail")).length;
    const lastDate = coerceTimestamp(lead.wa_1_sent_at) || lead.last_activity || lead.created_at || null;
    const msgCount = conv.length || slotMsgs.length;
    return { conv, slotMsgs, botCount, replied, failedCount, lastDate, msgCount };
}

async function fetchWALeadsData(from: Date, to: Date): Promise<{ leads: any[] }> {
    const fromISO = startOfDay(from).toISOString();
    const toISO = endOfDay(to).toISOString();
    const res = await fetch(`/api/whatsapp-leads?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`);
    if (!res.ok) throw new Error(await res.text());
    const j = await res.json();
    return { leads: j.leads || j.nr_wf || [] };
}

export default function WhatsappChatPage() {
    const [leads, setLeads] = useState<any[]>([]);
    const [loadingWA, setLoadingWA] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    const [dateRange, setDateRange] = useState<any>({ from: subDays(new Date(), 7), to: new Date() });

    useEffect(() => {
        if (!dateRange?.from) return;
        setLoadingWA(true);
        fetchWALeadsData(dateRange.from, dateRange.to || dateRange.from)
            .then(data => {
                setLeads((data.leads || []).map((l: any) => ({
                    ...l,
                    whatsapp_conversation: parseJsonArray(l.whatsapp_conversation),
                })));
            })
            .catch(err => console.error("[WA chat]", err))
            .finally(() => setLoadingWA(false));
    }, [dateRange]);

    const [currentPage, setCurrentPage] = useState(1);
    const leadsPerPage = 10;
    const [showFilters, setShowFilters] = useState(false);

    const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const initialSelectedId = searchParams?.get("chat");

    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(initialSelectedId || null);
    const [selectedLeadObj, setSelectedLeadObj] = useState<any | null>(null);
    const initialProcessed = useRef(false);

    useEffect(() => {
        const url = new URL(window.location.origin + window.location.pathname);
        if (selectedLeadId) url.searchParams.set("chat", selectedLeadId);
        else url.searchParams.delete("chat");
        window.history.replaceState({}, "", url.toString());
    }, [selectedLeadId]);

    useEffect(() => {
        if (initialProcessed.current) return;
        if (initialSelectedId) setSelectedLeadId(initialSelectedId);
        initialProcessed.current = true;
    }, [initialSelectedId]);

    const [pendingFilters, setPendingFilters] = useState<{ replyStatus: string[]; messageStatus: string[]; }>({ replyStatus: [], messageStatus: [] });
    const [activeFilters, setActiveFilters] = useState<{ replyStatus: string[]; messageStatus: string[]; }>({ replyStatus: [], messageStatus: [] });

    const leadsInRange = useMemo(() => {
        const from = dateRange?.from ? startOfDay(new Date(dateRange.from)).getTime() : null;
        const to = endOfDay(new Date(dateRange?.to || dateRange?.from || new Date())).getTime();
        const inRange = (t: number | null) => !from || (t != null && t >= from && t <= to);
        return leads.filter(lead => {
            const s = waSignals(lead);
            const t = s.lastDate ? new Date(s.lastDate).getTime() : null;
            return inRange(t) || t == null;
        });
    }, [leads, dateRange]);

    const filteredLeads = useMemo(() => {
        return leadsInRange.filter(lead => {
            const name = String(lead.full_name || [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "").toLowerCase();
            const phone = String(lead.phone || "");
            const matchesSearch = name.includes(searchQuery.toLowerCase()) || phone.includes(searchQuery);
            if (!matchesSearch) return false;

            const s = waSignals(lead);

            const matchesReplyStatus = activeFilters.replyStatus.length === 0 ||
                (activeFilters.replyStatus.includes("Replied") && s.replied) ||
                (activeFilters.replyStatus.includes("No Reply") && !s.replied);

            const matchesMessageStatus = activeFilters.messageStatus.length === 0 ||
                activeFilters.messageStatus.some(status => {
                    const target = status.toLowerCase();
                    return s.slotMsgs.some(m => String(m.status || "").toLowerCase().includes(target));
                });

            return matchesReplyStatus && matchesMessageStatus;
        }).sort((a, b) => {
            const da = waSignals(a).lastDate;
            const db = waSignals(b).lastDate;
            return (db ? new Date(db).getTime() : 0) - (da ? new Date(da).getTime() : 0);
        });
    }, [leadsInRange, searchQuery, activeFilters]);

    const activeLeads = filteredLeads;

    const stats = useMemo(() => {
        let sentCount = 0, repliedCount = 0, failedCount = 0;
        activeLeads.forEach(lead => {
            const s = waSignals(lead);
            sentCount += s.botCount;
            if (s.replied) repliedCount++;
            failedCount += s.failedCount;
        });
        const uniqueSentCount = activeLeads.length;
        const responseRate = uniqueSentCount > 0 ? ((repliedCount / uniqueSentCount) * 100).toFixed(1) : "0.0";
        return { totalLeads: activeLeads.length, sentCount, uniqueSentCount, repliedCount, failedCount, responseRate };
    }, [activeLeads]);

    const handleApplyFilters = () => setActiveFilters(pendingFilters);
    const handleResetFilters = () => {
        const reset = { replyStatus: [], messageStatus: [] };
        setPendingFilters(reset);
        setActiveFilters(reset);
    };
    const toggleFilter = (type: "replyStatus" | "messageStatus", value: string) => {
        setPendingFilters(prev => {
            const current = prev[type];
            return { ...prev, [type]: current.includes(value) ? current.filter(v => v !== value) : [...current, value] };
        });
    };

    const paginatedLeads = useMemo(() => {
        const start = (currentPage - 1) * leadsPerPage;
        return activeLeads.slice(start, start + leadsPerPage);
    }, [activeLeads, currentPage]);

    const totalPages = Math.ceil(activeLeads.length / leadsPerPage);
    useEffect(() => { setCurrentPage(1); }, [searchQuery, activeFilters, dateRange]);

    const renderPageButton = (page: number) => (
        <Button key={page} variant={currentPage === page ? "default" : "outline"} size="sm"
            className={`h-8 w-8 text-xs font-bold ${currentPage === page ? "bg-slate-900 text-white" : "text-slate-600"}`}
            onClick={() => setCurrentPage(page)}>
            {page}
        </Button>
    );
    const renderPaginationItems = () => {
        const items = [];
        const maxVisible = 5;
        if (totalPages <= maxVisible + 2) {
            for (let i = 1; i <= totalPages; i++) items.push(renderPageButton(i));
        } else {
            items.push(renderPageButton(1));
            if (currentPage > 3) items.push(<span key="dots-1" className="flex items-center justify-center w-8 h-8 text-slate-400"><MoreHorizontal className="h-4 w-4" /></span>);
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);
            for (let i = start; i <= end; i++) if (i > 1 && i < totalPages) items.push(renderPageButton(i));
            if (currentPage < totalPages - 2) items.push(<span key="dots-2" className="flex items-center justify-center w-8 h-8 text-slate-400"><MoreHorizontal className="h-4 w-4" /></span>);
            items.push(renderPageButton(totalPages));
        }
        return items;
    };

    return (
        <div className="space-y-5 pb-10 relative min-h-[500px]">
            {loadingWA && <WorldWideLoader />}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "var(--ls-heading)", color: "var(--label-primary)" }}>WhatsApp Chats</h1>
                    <p style={{ fontSize: 13, color: "var(--label-secondary)", marginTop: 2 }}>Real-time engagement across your leads</p>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                    <DateRangePicker onUpdate={(values) => setDateRange(values.range)} />
                    <button onClick={() => window.location.reload()}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: "var(--radius-lg)", background: "var(--fill-tertiary)", border: "1px solid var(--glass-border)", color: "var(--label-secondary)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                        <RefreshCw style={{ width: 13, height: 13 }} /> Refresh
                    </button>
                </div>
            </div>

            <div className="flex lg:hidden items-center gap-2">
                <button onClick={() => setShowFilters(!showFilters)}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: "var(--radius-md)", border: "1px solid var(--hairline)", background: "var(--fill-tertiary)", fontSize: 13, fontWeight: 500, color: "var(--label-secondary)", cursor: "pointer" }}>
                    <Filter style={{ width: 13, height: 13 }} />
                    {showFilters ? "Hide" : "Show"} Filters
                    {(activeFilters.replyStatus.length > 0 || activeFilters.messageStatus.length > 0) && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--green)", marginLeft: 2 }} />}
                </button>
                {(activeFilters.replyStatus.length > 0 || activeFilters.messageStatus.length > 0) && (
                    <button onClick={handleResetFilters} style={{ fontSize: 11, fontWeight: 700, color: "var(--blue)", background: "none", border: "none", cursor: "pointer" }}>RESET ALL</button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
                <div className={`lg:col-span-1 space-y-4 ${showFilters ? "block" : "hidden"} lg:block`}>
                    <div className="liquid-card" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 20 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--hairline)", paddingBottom: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--label-primary)", fontSize: 13, fontWeight: 600 }}>
                                <Filter style={{ width: 14, height: 14 }} /> Filters
                            </div>
                        </div>

                        <FilterSection title="Reply Status">
                            <FilterOption label="Replied" checked={pendingFilters.replyStatus.includes("Replied")} onCheckedChange={() => toggleFilter("replyStatus", "Replied")} />
                            <FilterOption label="No Reply" checked={pendingFilters.replyStatus.includes("No Reply")} onCheckedChange={() => toggleFilter("replyStatus", "No Reply")} />
                        </FilterSection>

                        <FilterSection title="Message Status">
                            <FilterOption label="Read" checked={pendingFilters.messageStatus.includes("Read")} onCheckedChange={() => toggleFilter("messageStatus", "Read")} />
                            <FilterOption label="Sent" checked={pendingFilters.messageStatus.includes("Sent")} onCheckedChange={() => toggleFilter("messageStatus", "Sent")} />
                            <FilterOption label="Failed" checked={pendingFilters.messageStatus.includes("Failed")} onCheckedChange={() => toggleFilter("messageStatus", "Failed")} />
                            <FilterOption label="Delivered" checked={pendingFilters.messageStatus.includes("Delivered")} onCheckedChange={() => toggleFilter("messageStatus", "Delivered")} />
                        </FilterSection>

                        <button onClick={handleApplyFilters}
                            style={{ width: "100%", padding: "7px 0", borderRadius: "var(--radius-md)", background: "var(--blue)", color: "#fff", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}>
                            Apply Filters
                        </button>
                    </div>
                </div>

                <div className="lg:col-span-3 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        <div className="md:col-span-2 xl:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <MetricCard title="Messages Sent" value={loadingWA ? "..." : stats.sentCount.toLocaleString()} desc="Total outgoing" icon={Send} />
                            <MetricCard title="Unique Contacted" value={loadingWA ? "..." : stats.uniqueSentCount.toLocaleString()} desc="Unique leads" icon={Users} />
                            <MetricCard title="Total Replies" value={loadingWA ? "..." : stats.repliedCount.toLocaleString()} desc={`${stats.responseRate}% Response Rate`} icon={MessageSquare} />
                        </div>
                        <div className="liquid-card" style={{ padding: "14px 16px" }}>
                            <div style={{ marginBottom: 12 }}>
                                <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--label-primary)" }}>Delivery Status</h3>
                                <p style={{ fontSize: 11, color: "var(--label-tertiary)", marginTop: 2 }}>Outbound health</p>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                <StatusBar label="Sent" value={stats.sentCount} total={stats.sentCount || 1} color="var(--blue)" />
                                <StatusBar label="Replied" value={stats.repliedCount} total={stats.uniqueSentCount || 1} color="var(--green)" />
                                {stats.failedCount > 0 && <StatusBar label="Failed" value={stats.failedCount} total={stats.sentCount || 1} color="var(--red)" />}
                            </div>
                        </div>
                    </div>

                    <div style={{ position: "relative" }}>
                        <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--label-tertiary)" }} />
                        <Input className="pl-10" style={{ background: "var(--fill-tertiary)", border: "1px solid var(--glass-border)", color: "var(--label-primary)", borderRadius: "var(--radius-lg)" }} placeholder="Search by name or phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>

                    <div className="liquid-card" style={{ padding: 0, overflow: "hidden" }}>
                        {loadingWA ? (
                            <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--label-tertiary)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                                <RefreshCw style={{ width: 18, height: 18, color: "var(--green)" }} className="animate-spin" />
                                <span style={{ fontSize: 13 }}>Loading real-time chats...</span>
                            </div>
                        ) : activeLeads.length === 0 ? (
                            <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--label-tertiary)", fontSize: 13 }}>No WhatsApp chats found.</div>
                        ) : (
                            <TooltipProvider>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm min-w-[640px]">
                                        <thead style={{ borderBottom: "1px solid var(--hairline)" }}>
                                            <tr style={{ background: "var(--fill-quaternary)" }}>
                                                <th style={{ padding: "10px 16px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--label-tertiary)" }}>Lead</th>
                                                <th style={{ padding: "10px 16px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--label-tertiary)", textAlign: "center" }}>Messages</th>
                                                <th style={{ padding: "10px 16px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--label-tertiary)", textAlign: "center" }}>Status</th>
                                                <th style={{ padding: "10px 16px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--label-tertiary)", textAlign: "center" }}>Message Status</th>
                                                <th style={{ padding: "10px 16px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--label-tertiary)", textAlign: "right" }}>Last Contacted</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {paginatedLeads.map((lead, idx) => {
                                                const leadId = lead.lead_id || lead.crm_id || lead.id || String(idx);
                                                return (
                                                    <CustomerRow key={`${leadId}-${idx}`} lead={lead} onClick={() => {
                                                        setSelectedLeadObj({
                                                            ...lead,
                                                            id: leadId,
                                                            name: lead.full_name || [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "",
                                                            phone: lead.phone || "",
                                                            email: lead.email || "",
                                                        });
                                                        setSelectedLeadId(leadId);
                                                    }} />
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </TooltipProvider>
                        )}

                        {totalPages > 1 && (
                            <div style={{ borderTop: "1px solid var(--hairline)", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--fill-quaternary)" }}>
                                <div style={{ fontSize: 12, color: "var(--label-tertiary)", fontWeight: 500 }}>
                                    Showing <span style={{ color: "var(--label-primary)", fontWeight: 700 }}>{(currentPage - 1) * leadsPerPage + 1}</span> – <span style={{ color: "var(--label-primary)", fontWeight: 700 }}>{Math.min(currentPage * leadsPerPage, activeLeads.length)}</span> of <span style={{ color: "var(--label-primary)", fontWeight: 700 }}>{activeLeads.length}</span>
                                </div>
                                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)}><ChevronLeft className="h-3 w-3" /></Button>
                                    <div style={{ display: "flex", gap: 3 }}>{renderPaginationItems()}</div>
                                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)}><ChevronRight className="h-3 w-3" /></Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Dialog open={!!selectedLeadId} onOpenChange={(open) => { if (!open) { setSelectedLeadId(null); setSelectedLeadObj(null); } }}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-6 gap-0">
                    <DialogHeader className="sr-only"><DialogTitle>WhatsApp Chat Detail</DialogTitle></DialogHeader>
                    {selectedLeadId && (
                        <WhatsAppChatDetail customerId={selectedLeadId} initialLead={selectedLeadObj} onClose={() => { setSelectedLeadId(null); setSelectedLeadObj(null); }} />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function MetricCard({ title, value, desc, icon: Icon }: any) {
    return (
        <div className="liquid-card" style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ padding: 7, borderRadius: "var(--radius-sm)", background: "rgba(10,132,255,0.10)", color: "var(--blue)", flexShrink: 0 }}>
                    <Icon style={{ width: 14, height: 14 }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--label-tertiary)" }}>{title}</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "var(--ls-metric)", color: "var(--label-primary)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
            <div style={{ fontSize: 11, color: "var(--label-tertiary)", marginTop: 4 }}>{desc}</div>
        </div>
    );
}

function StatusBar({ label, value, total, color }: any) {
    const pct = ((value / total) * 100).toFixed(1);
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 500, color: "var(--label-secondary)" }}>
                <span>{label}</span><span>{value} ({pct}%)</span>
            </div>
            <div style={{ height: 4, width: "100%", background: "var(--fill-tertiary)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", background: color, width: `${pct}%`, borderRadius: 99 }} />
            </div>
        </div>
    );
}

function FilterSection({ title, children }: any) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h4 style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--label-tertiary)" }}>{title}</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
        </div>
    );
}

function FilterOption({ label, checked, onCheckedChange }: any) {
    return (
        <button onClick={onCheckedChange}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 9px", borderRadius: 7, cursor: "pointer", background: checked ? "rgba(10,132,255,0.10)" : "transparent", border: `1px solid ${checked ? "rgba(10,132,255,0.25)" : "transparent"}`, width: "100%", textAlign: "left" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: checked ? "var(--blue)" : "var(--fill-secondary)", border: `1.5px solid ${checked ? "var(--blue)" : "var(--hairline)"}` }} />
            <span style={{ fontSize: 12, fontWeight: checked ? 600 : 400, color: checked ? "var(--blue)" : "var(--label-secondary)", flex: 1 }}>{label}</span>
        </button>
    );
}

function CustomerRow({ lead, onClick }: { lead: any; onClick: () => void }) {
    const s = waSignals(lead);
    const latestDate = s.lastDate ? new Date(s.lastDate) : new Date(0);
    const displayName = lead.full_name || [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "—";
    const displayPhone = lead.phone || "—";
    const displayStatuses = s.slotMsgs.filter(m => m.status).slice(-2);

    const formatTooltipDate = (date: Date) => {
        if (isNaN(date.getTime())) return "";
        const now = new Date();
        if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        return date.toLocaleString([], { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
    };

    return (
        <tr style={{ borderBottom: "1px solid var(--hairline)", cursor: "pointer", transition: "background 100ms" }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--fill-quaternary)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            onClick={onClick}>
            <td style={{ padding: "10px 16px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--label-primary)" }}>{displayName}</div>
                <div style={{ fontSize: 11, color: "var(--label-tertiary)", marginTop: 2 }}>{displayPhone}</div>
            </td>
            <td style={{ padding: "10px 16px", textAlign: "center", fontSize: 13, fontWeight: 600, color: "var(--label-primary)", fontVariantNumeric: "tabular-nums" }}>{s.msgCount}</td>
            <td className="px-4 py-3 text-center">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div>
                                {s.replied ? (
                                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none text-[10px] font-bold">REPLIED</Badge>
                                ) : (
                                    <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-200">SENT</Badge>
                                )}
                            </div>
                        </TooltipTrigger>
                        {s.replied && (
                            <TooltipContent side="top" className="bg-slate-800/40 backdrop-blur-md text-white text-[10px] border-none px-2 py-1 shadow-xl">
                                {formatTooltipDate(latestDate)}
                            </TooltipContent>
                        )}
                    </Tooltip>
                </TooltipProvider>
            </td>
            <td className="px-4 py-3 text-center">
                <div className="flex flex-col items-center gap-1.5">
                    {displayStatuses.map((m) => <MessageStatusBadge key={m.n} index={m.n} status={m.status || ""} sentAt={m.sent_at} />)}
                    {displayStatuses.length === 0 && <span className="text-slate-300 text-[10px]">—</span>}
                </div>
            </td>
            <td style={{ padding: "10px 16px", textAlign: "right", fontSize: 12, color: "var(--label-tertiary)", whiteSpace: "nowrap" }}>
                {latestDate.getTime() ? latestDate.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" }) : "—"}
            </td>
        </tr>
    );
}

function MessageStatusBadge({ index, status, sentAt }: { index: number; status: string; sentAt: string | null }) {
    if (!status) return null;
    const formatted = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    let badgeClass = "bg-slate-100 text-slate-600 border-slate-200";
    if (formatted.includes("Deliver")) badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (formatted.includes("Read")) badgeClass = "bg-blue-50 text-blue-700 border-blue-100";
    if (formatted.includes("Fail")) badgeClass = "bg-red-50 text-red-700 border-red-100";

    const tsDate = coerceTimestamp(sentAt);
    const tooltipText = tsDate ? new Date(tsDate).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 w-full justify-center cursor-help">
                        <span className="text-[9px] text-slate-400 font-mono select-none">{index}</span>
                        <Badge variant="outline" className={`h-5 px-1.5 text-[9px] font-bold uppercase tracking-wider ${badgeClass}`}>{formatted}</Badge>
                    </div>
                </TooltipTrigger>
                {tooltipText && (
                    <TooltipContent side="top" className="bg-slate-800/40 backdrop-blur-md text-white text-[10px] border-none px-2 py-1 shadow-xl">{tooltipText}</TooltipContent>
                )}
            </Tooltip>
        </TooltipProvider>
    );
}
