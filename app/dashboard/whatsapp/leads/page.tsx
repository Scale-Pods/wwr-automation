"use client";

import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Search,
    Filter,
    ChevronLeft,
    ChevronRight,
    MoreVertical,
    RefreshCw
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { subDays, startOfDay, endOfDay } from "date-fns";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { WhatsAppChatDetail } from "@/components/dashboard/whatsapp-chat-detail";
import { WorldWideLoader } from "@/components/world-wide-loader";
import { isReplyTrackPositive, coerceTimestamp } from "@/lib/outreach-types";

interface UnifiedLead {
    id: string;
    name: string;
    phone: string;
    email?: string;
    hasReplied: boolean;
    date: Date | null;
    raw: any;
}

function getLeadDate(lead: any): Date | null {
    const ref = coerceTimestamp(lead.wa_1_sent_at) || lead.last_activity || lead.created_at;
    if (ref) { const d = new Date(ref); if (!isNaN(d.getTime())) return d; }
    return null;
}

export default function WhatsappLeadsPage() {
    const [waLeads, setWaLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedLeadIdForChat, setSelectedLeadIdForChat] = useState<string | null>(null);
    const [selectedLeadObj, setSelectedLeadObj] = useState<any | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const leadsPerPage = 10;

    const [dateRange, setDateRange] = useState<any>({
        from: subDays(new Date(), 7),
        to: new Date(),
    });

    const [replyFilter, setReplyFilter] = useState<string[]>([]);

    const fetchWAData = useCallback(async (from: Date, to: Date) => {
        setLoading(true);
        try {
            const fromISO = startOfDay(from).toISOString();
            const toISO = endOfDay(to).toISOString();
            const res = await fetch(`/api/whatsapp-leads?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`);
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            const fetched = data.leads || data.nr_wf || [];
            setWaLeads(fetched);
        } catch (err) {
            console.error("[WA leads]", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!dateRange?.from) return;
        fetchWAData(dateRange.from, dateRange.to || dateRange.from);
    }, [dateRange, fetchWAData]);

    const allUnifiedLeads = useMemo<UnifiedLead[]>(() => {
        const list: UnifiedLead[] = [];

        waLeads.forEach((lead, idx) => {
            const id = String(lead.lead_id || lead.crm_id || lead.id || `lead-${idx}`);
            let hasReplied = isReplyTrackPositive(lead.whatsapp_reply_track);
            if (!hasReplied && Array.isArray(lead.whatsapp_conversation)) {
                hasReplied = lead.whatsapp_conversation.some((m: any) => {
                    const role = m.role || m.type || m.sender;
                    return role === 'user' || role === 'User' || role === 'customer';
                });
            }
            const fullName = lead.full_name || [lead.first_name, lead.last_name].filter(Boolean).join(' ') || "—";
            list.push({
                id,
                name: fullName,
                phone: lead.phone || "—",
                email: lead.email,
                hasReplied,
                date: getLeadDate(lead),
                raw: lead
            });
        });

        return list;
    }, [waLeads]);

    const filteredLeads = useMemo(() => {
        setCurrentPage(1);
        return allUnifiedLeads.filter(lead => {
            const matchesSearch =
                lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (lead.email && lead.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
                lead.phone.includes(searchQuery);
            if (!matchesSearch) return false;

            if (replyFilter.length > 0) {
                const ok = (replyFilter.includes("Replied") && lead.hasReplied) ||
                    (replyFilter.includes("Sent") && !lead.hasReplied);
                if (!ok) return false;
            }

            return true;
        });
    }, [allUnifiedLeads, searchQuery, replyFilter]);

    const toggleReplyFilter = (value: string) => {
        setReplyFilter(prev =>
            prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
        );
    };

    const resetFilters = () => {
        setReplyFilter([]);
        setSearchQuery("");
    };

    const totalPages = Math.ceil(filteredLeads.length / leadsPerPage);

    const paginatedLeads = filteredLeads.slice(
        (currentPage - 1) * leadsPerPage,
        currentPage * leadsPerPage
    );

    const toggleSelectAll = () => {
        if (selectedLeadIds.length === filteredLeads.length) setSelectedLeadIds([]);
        else setSelectedLeadIds(filteredLeads.map(l => l.id));
    };

    const toggleSelect = (id: string) => {
        setSelectedLeadIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    return (
        <div className="space-y-5 pb-10 relative min-h-[500px]">
            {loading && <WorldWideLoader />}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: 'var(--ls-heading)', color: 'var(--label-primary)' }}>WhatsApp Leads</h1>
                    <p style={{ fontSize: 13, color: 'var(--label-secondary)', marginTop: 2 }}>Review all leads contacted via WhatsApp</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {(replyFilter.length > 0 || searchQuery) && (
                        <button onClick={resetFilters} style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer' }}>RESET FILTERS</button>
                    )}
                    <DateRangePicker onUpdate={({ range }) => setDateRange({ from: range?.from, to: range?.to })} />
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="liquid-card" style={{ padding: '12px 14px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: 'var(--label-tertiary)' }} />
                    <Input
                        style={{ paddingLeft: 30, height: 36, background: 'var(--fill-tertiary)', border: '1px solid var(--glass-border)', color: 'var(--label-primary)', fontSize: 13, borderRadius: 'var(--radius-md)' }}
                        placeholder="Search Leads..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)', background: replyFilter.length > 0 ? 'rgba(10,132,255,0.10)' : 'var(--fill-tertiary)', color: replyFilter.length > 0 ? 'var(--blue)' : 'var(--label-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                                <Filter style={{ width: 12, height: 12 }} />
                                {replyFilter.length > 0 ? `Status (${replyFilter.length})` : 'Status'}
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 apple-dialog">
                            <DropdownMenuItem onClick={() => toggleReplyFilter('Replied')} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                Replied {replyFilter.includes('Replied') && "✓"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleReplyFilter('Sent')} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                Sent {replyFilter.includes('Sent') && "✓"}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <button
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)', background: 'var(--fill-tertiary)', color: 'var(--label-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'background 130ms' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--fill-secondary)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'var(--fill-tertiary)')}
                        onClick={() => { if (dateRange?.from) fetchWAData(dateRange.from, dateRange.to || dateRange.from); }}
                    >
                        <RefreshCw style={{ width: 12, height: 12 }} /> Refresh
                    </button>
                </div>
            </div>

            {/* Bulk Action Bar */}
            {selectedLeadIds.length > 0 && (
                <div className="liquid-card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--label-primary)' }}>{selectedLeadIds.length} leads selected</span>
                    <button style={{ fontSize: 12, fontWeight: 500, color: 'var(--label-secondary)', background: 'var(--fill-tertiary)', border: '1px solid var(--glass-border)', padding: '4px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>Export Selected</button>
                </div>
            )}

            {/* Table */}
            <div className="liquid-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead style={{ borderBottom: '1px solid var(--hairline)' }}>
                            <tr style={{ background: 'var(--fill-quaternary)' }}>
                                <th style={{ padding: '10px 16px', width: 40 }}>
                                    <Checkbox
                                        checked={selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0}
                                        onCheckedChange={toggleSelectAll}
                                    />
                                </th>
                                <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--label-tertiary)' }}>Name</th>
                                <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--label-tertiary)' }}>Phone</th>
                                <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--label-tertiary)', textAlign: 'center' }}>Reply Status</th>
                                <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--label-tertiary)' }}>Date</th>
                                <th style={{ padding: '10px 16px', width: 40 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: '80px 16px', textAlign: 'center', color: 'var(--label-tertiary)' }}>
                                        <RefreshCw style={{ width: 20, height: 20, margin: '0 auto 8px', animation: 'spin 1s linear infinite', color: 'var(--green)' }} />
                                        Loading WhatsApp leads...
                                    </td>
                                </tr>
                            ) : filteredLeads.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: '80px 16px', textAlign: 'center', color: 'var(--label-tertiary)' }}>
                                        No leads found for this date range.
                                    </td>
                                </tr>
                            ) : (
                                paginatedLeads.map((lead, index) => {
                                    return (
                                        <tr
                                            key={`${lead.id}-${index}`}
                                            style={{ borderBottom: '1px solid var(--hairline)', cursor: 'pointer', transition: 'background 120ms' }}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--fill-quaternary)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                            onClick={() => { setSelectedLeadIdForChat(lead.id); setSelectedLeadObj(lead.raw); }}
                                        >
                                            <td style={{ padding: '12px 16px' }} onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={selectedLeadIds.includes(lead.id)}
                                                    onCheckedChange={() => toggleSelect(lead.id)}
                                                />
                                            </td>
                                            <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--label-primary)' }}>{lead.name}</td>
                                            <td style={{ padding: '12px 16px', fontSize: 11, fontFamily: 'monospace', color: 'var(--label-secondary)' }}>{lead.phone}</td>
                                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                                {lead.hasReplied
                                                    ? <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontSize: 10, fontWeight: 700, background: 'rgba(48,209,88,0.12)', color: 'var(--green)' }}>REPLIED</span>
                                                    : <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontSize: 10, fontWeight: 600, border: '1px solid var(--hairline)', color: 'var(--label-tertiary)' }}>SENT</span>
                                                }
                                            </td>
                                            <td style={{ padding: '12px 16px', fontSize: 11, color: 'var(--label-tertiary)' }}>
                                                {lead.date ? lead.date.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                                                <button style={{ width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'var(--label-tertiary)', cursor: 'pointer' }}>
                                                    <MoreVertical style={{ width: 14, height: 14 }} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--hairline)', background: 'var(--fill-quaternary)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <p style={{ fontSize: 12, color: 'var(--label-tertiary)' }}>
                        Showing <span style={{ fontWeight: 700, color: 'var(--label-primary)' }}>
                            {paginatedLeads.length}
                        </span> of <span style={{ fontWeight: 700, color: 'var(--label-primary)' }}>
                            {filteredLeads.length}
                        </span> Leads
                    </p>

                    {totalPages > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <button
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(prev => prev - 1)}
                                style={{ width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', border: '1px solid var(--hairline)', background: 'var(--fill-tertiary)', color: 'var(--label-secondary)', cursor: 'pointer', opacity: currentPage === 1 ? 0.4 : 1 }}
                            >
                                <ChevronLeft style={{ width: 14, height: 14 }} />
                            </button>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 3, margin: '0 4px' }}>
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum: number;
                                    if (totalPages <= 5) pageNum = i + 1;
                                    else if (currentPage <= 3) pageNum = i + 1;
                                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                    else pageNum = currentPage - 2 + i;
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => setCurrentPage(pageNum)}
                                            style={{ width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', border: currentPage === pageNum ? 'none' : '1px solid var(--hairline)', background: currentPage === pageNum ? 'var(--blue)' : 'var(--fill-tertiary)', color: currentPage === pageNum ? '#fff' : 'var(--label-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                            </div>

                            <button
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(prev => prev + 1)}
                                style={{ width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', border: '1px solid var(--hairline)', background: 'var(--fill-tertiary)', color: 'var(--label-secondary)', cursor: 'pointer', opacity: currentPage === totalPages ? 0.4 : 1 }}
                            >
                                <ChevronRight style={{ width: 14, height: 14 }} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Chat Detail Modal */}
            <Dialog open={!!selectedLeadIdForChat} onOpenChange={(open) => { if (!open) { setSelectedLeadIdForChat(null); setSelectedLeadObj(null); } }}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-6 gap-0 apple-dialog">
                    <DialogHeader className="sr-only">
                        <DialogTitle>WhatsApp Chat Detail</DialogTitle>
                    </DialogHeader>
                    {selectedLeadIdForChat && (
                        <WhatsAppChatDetail
                            customerId={selectedLeadIdForChat}
                            initialLead={selectedLeadObj as any}
                            onClose={() => { setSelectedLeadIdForChat(null); setSelectedLeadObj(null); }}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
