"use client";

import { useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Search, Mail, MessageCircle, Phone } from "lucide-react";
import { isReplyTrackPositive, parseJsonArray, coerceTimestamp } from "@/lib/outreach-types";

interface ReplyData {
    id: string;
    contactName: string;
    contactInfo: string;
    mode: 'Email' | 'WhatsApp' | 'Voice';
    date: string;
    time: string;
    status: 'Replied' | 'Pending' | 'Follow-up';
    preview: string;
    rawLead?: any;
}



export function TotalRepliesView({ leads = [], dateRange, onViewLead }: { leads?: any[], dateRange?: { from?: Date, to?: Date } | null, onViewLead?: (lead: any) => void }) {
    const [search, setSearch] = useState("");
    const [modeFilter, setModeFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    // Extract an ISO date embedded in a reply-track string, e.g.
    // "Yes - email done on 2026-09-05T10:00:00+03:00" or "Yes 2026-08-17T17:00:30.407+03:00".
    const parseTrackDate = (raw: any): Date | null => {
        if (!raw) return null;
        const s = String(raw);
        const m = s.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^\s]*/);
        if (m) { const d = new Date(m[0]); if (!isNaN(d.getTime())) return d; }
        return null;
    };

    // Last inbound message content from a conversation JSON array (WhatsApp/email shape).
    const lastInboundContent = (conv: any[], inboundRoles: string[]): string => {
        for (let i = conv.length - 1; i >= 0; i--) {
            const m = conv[i];
            const role = String(m?.role || m?.direction || m?.type || m?.sender || "").toLowerCase();
            if (inboundRoles.includes(role)) {
                return String(m.message || m.content || m.text || m.body_text || m.body || "").trim();
            }
        }
        return "";
    };

    // Map real leads to ReplyData format
    const realData: (ReplyData & { link: string; sortDate: Date })[] = [];

    leads.forEach((lead: any, idx: number) => {
        const fallbackDate = new Date(lead.updated_at || lead.created_at || 0);

        // --- WhatsApp Logic --- (source of truth: whatsapp_reply_track, e.g. "Yes ...on <ISO>")
        const waTrack = lead.whatsapp_reply_track;
        const hasWP = isReplyTrackPositive(waTrack) || !!lead.whatsapp_replied;

        if (hasWP) {
            const waConv = parseJsonArray(lead.whatsapp_conversation);
            const trackDate = parseTrackDate(waTrack);
            const wpDate = trackDate
                || (coerceTimestamp(lead.last_activity) ? new Date(coerceTimestamp(lead.last_activity)!) : null)
                || fallbackDate;
            const wpContent = lastInboundContent(waConv, ["user", "customer", "inbound", "received"])
                || lead.last_whatsapp_message
                || "Lead replied via WhatsApp";

            const leadId = lead.lead_id || lead.id || lead.crm_id || `lead-${idx}`;
            realData.push({
                id: `${leadId}-wp`,
                contactName: lead.full_name || lead.name || "Unknown",
                contactInfo: lead.phone || "No info",
                mode: 'WhatsApp',
                date: wpDate.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }),
                time: wpDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                status: 'Replied',
                preview: wpContent.substring(0, 70) + (wpContent.length > 70 ? "..." : ""),
                link: `/dashboard/whatsapp/chat?chat=${leadId}`,
                rawLead: lead,
                sortDate: wpDate
            });
        }

        // --- Email Logic --- (source of truth: email_reply_track, e.g. "Yes - email done on <ISO>")
        const emailTrack = lead.email_reply_track;
        const hasEmail = isReplyTrackPositive(emailTrack) || !!lead.email_replied;

        if (hasEmail) {
            const emailConv = parseJsonArray(lead.email_conversation);
            const trackDate = parseTrackDate(emailTrack);
            const emailDate = trackDate
                || (coerceTimestamp(lead.last_activity) ? new Date(coerceTimestamp(lead.last_activity)!) : null)
                || fallbackDate;
            const emailContent = lastInboundContent(emailConv, ["user", "inbound", "received", "reply", "customer"])
                || lead.email_note
                || "Lead replied via Email";

            const leadId = lead.lead_id || lead.id || lead.crm_id || `lead-${idx}`;
            realData.push({
                id: `${leadId}-email`,
                contactName: lead.full_name || lead.name || "Unknown",
                contactInfo: lead.email || "No info",
                mode: 'Email',
                date: emailDate.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }),
                time: emailDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                status: 'Replied',
                preview: emailContent.substring(0, 70) + (emailContent.length > 70 ? "..." : ""),
                link: `/dashboard/email/received`,
                rawLead: lead,
                sortDate: emailDate
            });
        }
    });

    // Sort heavily by newest reply first
    realData.sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());

    // Filter logic
    const rangeFrom = dateRange?.from ? new Date(dateRange.from).setHours(0, 0, 0, 0) : null;
    const rangeTo = dateRange?.to ? new Date(dateRange.to).setHours(23, 59, 59, 999) : (dateRange?.from ? new Date(dateRange.from).setHours(23, 59, 59, 999) : null);

    const filteredData = realData.filter(item => {
        const matchesSearch = item.contactName.toLowerCase().includes(search.toLowerCase()) ||
            item.contactInfo.toLowerCase().includes(search.toLowerCase());
        const matchesMode = modeFilter === "all" || item.mode.toLowerCase() === modeFilter;
        const t = item.sortDate.getTime();
        const matchesDate = !rangeFrom || (t >= rangeFrom && (!rangeTo || t <= rangeTo));
        return matchesSearch && matchesMode && matchesDate;
    });

    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const displayedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex flex-1 items-center gap-2 w-full md:max-w-sm">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--label-secondary)]" />
                        <Input
                            placeholder="Search contacts..."
                            className="pl-9"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <Select value={modeFilter} onValueChange={setModeFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Mode" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Modes</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-md border bg-[var(--bg-layer1)] overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-[var(--fill-tertiary)]">
                            <TableHead>Contact</TableHead>
                            <TableHead>Mode</TableHead>
                            <TableHead>Date & Time</TableHead>
                            <TableHead>Preview</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {displayedData.length > 0 ? (
                            displayedData.map((item: any) => (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        <div className="font-medium">{item.contactName}</div>
                                        <div className="text-xs text-[var(--label-secondary)]">{item.contactInfo}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {item.mode === 'Email' && <Mail className="h-4 w-4 text-sky-500" />}
                                            {item.mode === 'WhatsApp' && <MessageCircle className="h-4 w-4 text-green-500" />}
                                            {item.mode === 'Voice' && <Phone className="h-4 w-4 text-purple-500" />}
                                            <span>{item.mode}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm">{item.date}</div>
                                        <div className="text-xs text-[var(--label-secondary)]">{item.time}</div>
                                    </TableCell>
                                    <TableCell className="max-w-[200px] truncate" title={item.preview}>
                                        {item.preview}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={item.status === 'Replied' ? 'default' : item.status === 'Pending' ? 'secondary' : 'outline'}>
                                            {item.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button size="sm" variant="ghost" className="text-blue-600 hover:text-blue-700" onClick={() => {
                                            if (onViewLead && item.rawLead) {
                                                onViewLead(item.rawLead);
                                            } else {
                                                window.location.href = item.link;
                                            }
                                        }}>
                                            View
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    No results found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
                <div className="text-sm text-[var(--label-secondary)]">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} entries
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="text-sm font-medium">Page {currentPage} of {Math.max(1, totalPages)}</div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
