"use client";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Search, Filter, Mail, ChevronDown, ChevronUp, ArrowRight, ArrowLeft, Reply,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format, subDays } from "date-fns";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useData } from "@/context/DataContext";
import { WorldWideLoader } from "@/components/world-wide-loader";
import { coerceTimestamp } from "@/lib/outreach-types";
import type { OutreachLead } from "@/lib/outreach-types";

const ITEMS_PER_PAGE = 7;

export default function SentEmailsPage() {
    const { leads: allLeads, loadingLeads } = useData();
    const [page, setPage] = useState(1);
    const [dateRange, setDateRange] = useState<any>({ from: subDays(new Date(), 7), to: new Date() });
    const [sentEmails, setSentEmails] = useState<any[]>([]);
    const loading = loadingLeads;
    const [searchQuery, setSearchQuery] = useState("");
    const [filters, setFilters] = useState({ sender: "all", type: "all" });

    useEffect(() => {
        if (loadingLeads) return;
        const emails: any[] = [];

        (allLeads as OutreachLead[]).forEach((lead, leadIndex) => {
            const replied = lead.email_replied;

            lead.email_slots.forEach(slot => {
                if (slot.raw == null && !slot.sent_at && !slot.status) return;
                const obj = slot.obj;
                const rawDate = coerceTimestamp(slot.sent_at) || coerceTimestamp(obj?.timestamp) || lead.created_at || null;

                let subject = obj?.subject || `Email ${slot.n}`;
                let fromAddr = obj?.from || "";
                let toAddr = obj?.to || lead.email || "";
                const emailBody = obj?.body_html || obj?.body_text || slot.body || "Email sent – no content stored.";

                let sentDate: string | null = null;
                if (rawDate) { try { sentDate = format(new Date(rawDate), "MMM dd, yyyy • p"); } catch { } }

                emails.push({
                    id: `${lead.lead_id || `lead-${leadIndex}`}-email-${slot.n}`,
                    recipient: toAddr || lead.name || `Lead ${leadIndex + 1}`,
                    sender: fromAddr || "Unknown Sender",
                    type: `Email ${slot.n}`,
                    typeNum: slot.n,
                    sentDate,
                    subject,
                    content: emailBody,
                    rawDate,
                    hasReplied: replied,
                    status: slot.status || obj?.status || "",
                    provider: obj?.provider || "",
                });
            });
        });

        emails.sort((a, b) => new Date(b.rawDate || 0).getTime() - new Date(a.rawDate || 0).getTime());
        setSentEmails(emails);
    }, [allLeads, loadingLeads]);

    const uniqueSenders = Array.from(new Set(sentEmails.map(e => e.sender))).sort();

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPage(1);
    };

    const filteredEmails = sentEmails.filter(email => {
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            if (!email.recipient.toLowerCase().includes(q) && !email.subject.toLowerCase().includes(q) && !email.content.toLowerCase().includes(q)) return false;
        }
        if (dateRange?.from) {
            const ed = email.rawDate ? new Date(email.rawDate) : null;
            if (!ed || isNaN(ed.getTime())) return false;
            const from = new Date(dateRange.from); from.setHours(0, 0, 0, 0);
            const to = dateRange.to ? new Date(dateRange.to) : new Date(from); to.setHours(23, 59, 59, 999);
            if (ed < from || ed > to) return false;
        }
        if (filters.sender !== "all" && email.sender !== filters.sender) return false;
        if (filters.type !== "all" && String(email.typeNum) !== filters.type) return false;
        return true;
    });

    const totalPages = Math.ceil(filteredEmails.length / ITEMS_PER_PAGE);
    const paginatedEmails = filteredEmails.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    return (
        <div className="space-y-5 pb-10 max-w-5xl mx-auto relative min-h-[500px]">
            {loading && <WorldWideLoader />}

            <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "var(--ls-heading)", color: "var(--label-primary)" }}>Sent Emails</h1>
                <p style={{ fontSize: 13, color: "var(--label-secondary)", marginTop: 2 }}>View and manage your sent email history.</p>
            </div>

            <div className="liquid-card" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
                        <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "var(--label-tertiary)" }} />
                        <Input placeholder="Search recipients, subjects..." style={{ paddingLeft: 30, height: 36, background: "var(--fill-tertiary)", border: "1px solid var(--glass-border)", color: "var(--label-primary)", fontSize: 12, borderRadius: "var(--radius-md)" }} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    </div>
                    <DateRangePicker className="w-full md:w-[260px]" onUpdate={values => setDateRange(values.range)} />
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    <Filter style={{ width: 13, height: 13, color: "var(--label-tertiary)", marginRight: 2 }} />
                    <Select value={filters.sender} onValueChange={val => handleFilterChange("sender", val)}>
                        <SelectTrigger style={{ width: 160, height: 32, fontSize: 12 }}><SelectValue placeholder="Sender" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Senders</SelectItem>
                            {uniqueSenders.map(sender => <SelectItem key={sender} value={sender}>{sender}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={filters.type} onValueChange={val => handleFilterChange("type", val)}>
                        <SelectTrigger style={{ width: 140, height: 32, fontSize: 12 }}><SelectValue placeholder="Email Step" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Steps</SelectItem>
                            {[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)}>Email {n}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <button style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color: "var(--label-secondary)", background: "var(--fill-tertiary)", border: "1px solid var(--glass-border)", padding: "5px 12px", borderRadius: "var(--radius-sm)", cursor: "pointer", height: 32 }}
                        onClick={() => { setSearchQuery(""); setDateRange(undefined); setFilters({ sender: "all", type: "all" }); setPage(1); }}>
                        Reset Filters
                    </button>
                </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {!loading && paginatedEmails.length > 0 ? (
                    paginatedEmails.map(email => <SentEmailCard key={email.id} email={email} />)
                ) : !loading ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 200, color: "var(--label-tertiary)", border: "1px dashed var(--hairline)", borderRadius: "var(--radius-xl)" }}>
                        <Mail style={{ width: 28, height: 28, marginBottom: 8, opacity: 0.4 }} />
                        <p style={{ fontSize: 13 }}>No emails found matching your filters</p>
                    </div>
                ) : null}
            </div>

            {!loading && filteredEmails.length > ITEMS_PER_PAGE && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid var(--hairline)" }}>
                    <p style={{ fontSize: 12, color: "var(--label-tertiary)" }}>
                        Showing <span style={{ fontWeight: 700, color: "var(--label-primary)" }}>{(page - 1) * ITEMS_PER_PAGE + 1}</span>–<span style={{ fontWeight: 700, color: "var(--label-primary)" }}>{Math.min(page * ITEMS_PER_PAGE, filteredEmails.length)}</span> of <span style={{ fontWeight: 700, color: "var(--label-primary)" }}>{filteredEmails.length}</span>
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--glass-border)", background: "var(--fill-tertiary)", color: "var(--label-secondary)", fontSize: 12, fontWeight: 500, cursor: "pointer", opacity: page === 1 ? 0.4 : 1 }} onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
                            <ArrowLeft style={{ width: 12, height: 12 }} /> Previous
                        </button>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--label-secondary)", padding: "0 8px" }}>Page {page} of {totalPages}</span>
                        <button style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--glass-border)", background: "var(--fill-tertiary)", color: "var(--label-secondary)", fontSize: 12, fontWeight: 500, cursor: "pointer", opacity: page === totalPages ? 0.4 : 1 }} onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
                            Next <ArrowRight style={{ width: 12, height: 12 }} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function SentEmailCard({ email }: { email: any }) {
    const [isOpen, setIsOpen] = useState(false);
    const stripHtml = (html: string) => !html ? "" : html.replace(/<(br|p|div|li|h[1-6])[^>]*>/gi, " ").replace(/<\/?[^>]+(>|$)/g, "");

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="liquid-card" style={{ padding: 0, overflow: "hidden", transition: "all 150ms" }}>
            <CollapsibleTrigger asChild>
                <div style={{ padding: "14px 18px", cursor: "pointer" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 38, height: 38, flexShrink: 0, background: "rgba(48,209,88,0.12)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(48,209,88,0.2)" }}>
                                <Mail style={{ width: 16, height: 16, color: "var(--green)" }} />
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 7px", borderRadius: "var(--radius-xs)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", background: "var(--fill-tertiary)", color: "var(--label-secondary)" }}>{email.type}</span>
                                    {email.hasReplied && (
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: "var(--radius-xs)", fontSize: 10, fontWeight: 700, background: "rgba(48,209,88,0.12)", color: "var(--green)" }}>
                                            <Reply style={{ width: 10, height: 10 }} /> Replied
                                        </span>
                                    )}
                                    {email.sentDate && <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 7px", borderRadius: "var(--radius-xs)", fontSize: 10, background: "rgba(10,132,255,0.08)", color: "var(--blue)" }}>{email.sentDate}</span>}
                                    {email.status && <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 7px", borderRadius: "var(--radius-xs)", fontSize: 10, fontWeight: 700, background: String(email.status).toUpperCase().includes("SENT") ? "rgba(48,209,88,0.12)" : "rgba(255,69,58,0.10)", color: String(email.status).toUpperCase().includes("SENT") ? "var(--green)" : "var(--red)" }}>{email.status}</span>}
                                </div>
                                <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--label-primary)" }}>{email.subject || email.type}</h4>
                                {!isOpen && (
                                    <p style={{ fontSize: 12, color: "var(--label-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 400 }}>
                                        {stripHtml(email.content).substring(0, 80)}...
                                    </p>
                                )}
                            </div>
                        </div>
                        <div style={{ flexShrink: 0, color: "var(--label-tertiary)" }}>
                            {isOpen ? <ChevronUp style={{ width: 14, height: 14 }} /> : <ChevronDown style={{ width: 14, height: 14 }} />}
                        </div>
                    </div>
                </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div style={{ padding: "0 18px 18px", borderTop: "1px solid var(--hairline)", paddingTop: 14 }}>
                    <div style={{ paddingLeft: 50, display: "flex", flexDirection: "column", gap: 10 }}>
                        {email.sender && <p style={{ fontSize: 11, color: "var(--label-tertiary)" }}><span style={{ fontWeight: 600, color: "var(--label-secondary)" }}>From:</span> {email.sender}</p>}
                        {email.recipient && email.recipient !== email.sender && <p style={{ fontSize: 11, color: "var(--label-tertiary)" }}><span style={{ fontWeight: 600, color: "var(--label-secondary)" }}>To:</span> {email.recipient}</p>}
                        {email.provider && <p style={{ fontSize: 11, color: "var(--label-tertiary)" }}><span style={{ fontWeight: 600, color: "var(--label-secondary)" }}>Provider:</span> {email.provider}</p>}
                        <div style={{ fontSize: 13, color: "var(--label-primary)", lineHeight: 1.6 }}>
                            <div className="email-content" dangerouslySetInnerHTML={{ __html: email.content }} />
                        </div>
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}
