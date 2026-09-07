"use client";

import { useEffect, useState, useMemo } from "react";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
    Users, AlertCircle, Loader2, RefreshCw, Mail, MessageCircle,
    ChevronLeft, ChevronRight, Search, Phone,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { subDays } from "date-fns";
import { WorldWideLoader } from "@/components/world-wide-loader";
import { useData } from "@/context/DataContext";
import type { OutreachLead } from "@/lib/outreach-types";

// ── Progress model: a lead's outreach journey across channels ────────────────
// 4 WhatsApp touches + 5 emails + 4 calls = 13 possible steps. Progress = done/total.
const JOURNEY_STEPS: { key: string; label: string; test: (l: OutreachLead) => boolean }[] = [
    { key: "wa1", label: "WhatsApp 1", test: l => !!l.wa_slots.find(s => s.n === 1 && (s.message || s.sent_at)) },
    { key: "wa2", label: "WhatsApp 2", test: l => !!l.wa_slots.find(s => s.n === 2 && (s.message || s.sent_at)) },
    { key: "wa3", label: "WhatsApp 3", test: l => !!l.wa_slots.find(s => s.n === 3 && (s.message || s.sent_at)) },
    { key: "wa4", label: "WhatsApp 4", test: l => !!l.wa_slots.find(s => s.n === 4 && (s.message || s.sent_at)) },
    // email_slots only contains slots where email_N itself has content (see buildEmailSlots).
    { key: "em1", label: "Email 1", test: l => !!l.email_slots.find(s => s.n === 1) },
    { key: "em2", label: "Email 2", test: l => !!l.email_slots.find(s => s.n === 2) },
    { key: "em3", label: "Email 3", test: l => !!l.email_slots.find(s => s.n === 3) },
    { key: "em4", label: "Email 4", test: l => !!l.email_slots.find(s => s.n === 4) },
    { key: "em5", label: "Email 5", test: l => !!l.email_slots.find(s => s.n === 5) },
    { key: "c1", label: "Call 1", test: l => !!l.call_slots.find(s => s.n === 1 && (s.date || s.status)) },
    { key: "c2", label: "Call 2", test: l => !!l.call_slots.find(s => s.n === 2 && (s.date || s.status)) },
    { key: "c3", label: "Call 3", test: l => !!l.call_slots.find(s => s.n === 3 && (s.date || s.status)) },
    { key: "c4", label: "Call 4", test: l => !!l.call_slots.find(s => s.n === 4 && (s.date || s.status)) },
];

function ProgressBreakdown({ lead }: { lead: OutreachLead }) {
    const breakdown = JOURNEY_STEPS.map(s => ({ name: s.label, isCompleted: s.test(lead) }));
    const completedCount = breakdown.filter(b => b.isCompleted).length;
    const progress = Math.round((completedCount / JOURNEY_STEPS.length) * 100);

    const data = [
        { name: "Completed", value: completedCount, color: "#10b981" },
        { name: "Remaining", value: JOURNEY_STEPS.length - completedCount, color: "var(--fill-secondary)" },
    ];

    return (
        <Dialog>
            <DialogTrigger asChild>
                <div className="cursor-pointer group relative">
                    <div className="flex justify-between items-center text-xs text-[var(--label-secondary)] mb-1.5">
                        <div className="flex items-center gap-1 group-hover:text-[var(--blue)] transition-colors">
                            <span className="font-medium">Step {completedCount} of {JOURNEY_STEPS.length}</span>
                            <ChevronRight className="h-3 w-3 opacity-0 -ml-1 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300" />
                        </div>
                        <span className="font-bold text-[var(--label-primary)]">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2 bg-[var(--fill-secondary)]" indicatorClassName="bg-gradient-to-r from-blue-500 to-cyan-500" />
                </div>
            </DialogTrigger>
            <DialogContent className="apple-dialog max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2" style={{ color: "var(--label-primary)" }}>
                        <span>Lead Journey</span>
                        {lead.workflow_name && (
                            <Badge variant="outline" className="ml-2 bg-[var(--fill-secondary)] text-[var(--label-primary)] border-[var(--glass-border)]">
                                {lead.workflow_name}
                            </Badge>
                        )}
                    </DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-6 py-4">
                    <div className="h-[160px] relative flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value" stroke="none">
                                    {data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center flex-col">
                            <span className="text-2xl font-bold text-[var(--label-primary)]">{progress}%</span>
                            <span className="text-[10px] text-[var(--label-tertiary)] uppercase font-bold">Complete</span>
                        </div>
                    </div>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                        {breakdown.map((step, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                                <div className={`h-2 w-2 rounded-full ${step.isCompleted ? "bg-emerald-500" : "bg-[var(--fill-secondary)]"}`} />
                                <span className={step.isCompleted ? "text-[var(--label-primary)] font-medium" : "text-[var(--label-tertiary)]"}>
                                    {step.name}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function LeadsPage() {
    const {
        leads, loadingLeads, refreshLeads,
        masterLeadsTotal, loadingMasterLeadsTotal, refreshMasterLeadsTotal,
    } = useData();
    const [dateRange, setDateRange] = useState<any>({ from: subDays(new Date(), 30), to: new Date() });
    const [templates, setTemplates] = useState<any[]>([]);
    const [view, setView] = useState<"leads" | "templates">("leads");
    const [templateFilter, setTemplateFilter] = useState<"email" | "whatsapp">("email");
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [channelFilter, setChannelFilter] = useState("all");
    const [stageFilter, setStageFilter] = useState("all");

    useEffect(() => {
        setCurrentPage(1);
    }, [view, templateFilter, searchQuery, statusFilter, channelFilter, stageFilter]);

    useEffect(() => {
        if (!dateRange?.from) return;
        refreshMasterLeadsTotal({ from: dateRange.from, to: dateRange.to || dateRange.from });
    }, [dateRange, refreshMasterLeadsTotal]);

    const loading = view === "leads" ? loadingLeads : false;

    const fetchTemplates = async () => {
        setError(null);
        try {
            const response = await fetch("/api/templates");
            if (!response.ok) throw new Error("Failed to fetch templates");
            setTemplates(await response.json());
        } catch (err) {
            console.error(err);
            setError("Could not load templates. Please try again later.");
        }
    };

    useEffect(() => {
        if (view === "templates") fetchTemplates();
    }, [view]);

    const stageOptions = useMemo(() => {
        const set = new Set<string>();
        leads.forEach((l: any) => { if (l.lead_stage) set.add(l.lead_stage); });
        return Array.from(set).sort();
    }, [leads]);

    const filteredLeads = useMemo(() => {
        return (leads as OutreachLead[]).filter(lead => {
            if (searchQuery) {
                const s = searchQuery.toLowerCase();
                const match = lead.name?.toLowerCase().includes(s)
                    || lead.email?.toLowerCase().includes(s)
                    || lead.phone?.toLowerCase().includes(s)
                    || (lead.company_name || "").toLowerCase().includes(s)
                    || (lead.crm_id || "").toLowerCase().includes(s)
                    || (lead.crm_name || "").toLowerCase().includes(s)
                    || (lead.module_name || "").toLowerCase().includes(s)
                    || (lead.property_type || "").toLowerCase().includes(s)
                    || (lead.property_category || "").toLowerCase().includes(s);
                if (!match) return false;
            }

            if (statusFilter !== "all") {
                const isReplied = lead.replied === "Yes";
                if (statusFilter === "replied" && !isReplied) return false;
                if (statusFilter === "sent" && isReplied) return false;
            }

            if (channelFilter !== "all") {
                const hasEmail = lead.email && lead.email !== "No Email";
                const hasWa = !!lead.phone;
                const hasCall = lead.call_slots.length > 0;
                if (channelFilter === "email" && !hasEmail) return false;
                if (channelFilter === "whatsapp" && !hasWa) return false;
                if (channelFilter === "voice" && !hasCall) return false;
            }

            if (stageFilter !== "all" && lead.lead_stage !== stageFilter) return false;

            return true;
        });
    }, [leads, searchQuery, statusFilter, channelFilter, stageFilter]);

    if (error) {
        return (
            <div className="p-6">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="space-y-6 relative min-h-[500px]">
            {loading && leads.length === 0 && <WorldWideLoader />}
            <div className="flex items-center justify-between">
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "var(--ls-heading)", color: "var(--label-primary)" }}>Leads</h1>
                    <p style={{ fontSize: 13, color: "var(--label-secondary)", marginTop: 2 }}>Manage and track your outreach leads.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {view === "leads" && <DateRangePicker onUpdate={({ range }) => setDateRange(range)} />}
                    <div style={{ display: "flex", background: "var(--fill-tertiary)", borderRadius: "var(--radius-md)", padding: 3, gap: 2 }}>
                        <button onClick={() => setView("leads")} style={{ padding: "5px 14px", borderRadius: "var(--radius-sm)", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: view === "leads" ? "var(--bg-layer1)" : "transparent", color: view === "leads" ? "var(--label-primary)" : "var(--label-secondary)", boxShadow: view === "leads" ? "var(--shadow-sm)" : "none" }}>Leads</button>
                        <button onClick={() => setView("templates")} style={{ padding: "5px 14px", borderRadius: "var(--radius-sm)", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: view === "templates" ? "var(--bg-layer1)" : "transparent", color: view === "templates" ? "var(--label-primary)" : "var(--label-secondary)", boxShadow: view === "templates" ? "var(--shadow-sm)" : "none" }}>Templates</button>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => view === "leads" ? refreshLeads({ force: true }) : fetchTemplates()} className="border-[var(--glass-border)] bg-[var(--fill-tertiary)] hover:bg-[var(--fill-secondary)] text-[var(--label-primary)] h-9">
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <div style={{ background: "var(--fill-secondary)", border: "1px solid var(--glass-border)", padding: "6px 12px", borderRadius: "var(--radius-md)", fontSize: 13, fontWeight: 500, color: "var(--label-secondary)" }}>
                        {view === "leads"
                            ? `Total Leads: ${loadingMasterLeadsTotal && masterLeadsTotal == null ? "…" : (masterLeadsTotal ?? leads.length).toLocaleString()}`
                            : `Templates: ${templates.length}`}
                    </div>
                </div>
            </div>

            <div className="liquid-card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--separator)" }}>
                    <div className="flex items-center gap-2">
                        {view === "leads" ? <Users className="h-5 w-5 text-[var(--blue)]" /> : <AlertCircle className="h-5 w-5 text-[var(--purple)]" />}
                        <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--label-primary)" }}>{view === "leads" ? "All Leads" : "Templates Library"}</h2>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--label-secondary)", marginTop: 2 }}>
                        {view === "leads" ? "Real-time data from outreach_table." : "Manage your messaging templates."}
                    </p>
                </div>

                {view === "leads" && (
                    <div style={{ padding: "12px 14px", background: "var(--fill-quaternary)", borderBottom: "1px solid var(--separator)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
                        <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
                            <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--label-tertiary)", pointerEvents: "none" }} />
                            <Input placeholder="Search by name, CRM, module, email, phone, or property..." className="border-none" style={{ paddingLeft: 36, height: 40, background: "var(--fill-tertiary)", border: "1px solid var(--glass-border)", color: "var(--label-primary)", borderRadius: "var(--radius-md)", fontSize: 13 }} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                        </div>
                        <div className="flex items-center gap-3">
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="border-none" style={{ width: 150, height: 40, background: "var(--fill-tertiary)", border: "1px solid var(--glass-border)", color: "var(--label-primary)", borderRadius: "var(--radius-md)" }}><SelectValue placeholder="Reply Status" /></SelectTrigger>
                                <SelectContent className="apple-dialog">
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="replied">Replied</SelectItem>
                                    <SelectItem value="sent">Sent Only</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={channelFilter} onValueChange={setChannelFilter}>
                                <SelectTrigger className="border-none" style={{ width: 150, height: 40, background: "var(--fill-tertiary)", border: "1px solid var(--glass-border)", color: "var(--label-primary)", borderRadius: "var(--radius-md)" }}><SelectValue placeholder="Channel" /></SelectTrigger>
                                <SelectContent className="apple-dialog">
                                    <SelectItem value="all">All Channels</SelectItem>
                                    <SelectItem value="email">Email</SelectItem>
                                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                    <SelectItem value="voice">Voice</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={stageFilter} onValueChange={setStageFilter}>
                                <SelectTrigger className="border-none" style={{ width: 160, height: 40, background: "var(--fill-tertiary)", border: "1px solid var(--glass-border)", color: "var(--label-primary)", borderRadius: "var(--radius-md)" }}><SelectValue placeholder="Stage" /></SelectTrigger>
                                <SelectContent className="apple-dialog">
                                    <SelectItem value="all">All Stages</SelectItem>
                                    {stageOptions.map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            {(searchQuery || statusFilter !== "all" || channelFilter !== "all" || stageFilter !== "all") && (
                                <Button variant="ghost" size="sm" className="text-[var(--label-secondary)] hover:text-rose-600 h-10 px-3 hover:bg-[var(--fill-secondary)] rounded-md" onClick={() => { setSearchQuery(""); setStatusFilter("all"); setChannelFilter("all"); setStageFilter("all"); }}>Clear</Button>
                            )}
                        </div>
                    </div>
                )}

                <div className="p-0">
                    {view === "leads" ? (
                        <>
                            <div className="overflow-x-auto">
                                <Table style={{ minWidth: 1080 }}>
                                    <TableHeader style={{ borderBottom: "1px solid var(--separator)" }}>
                                        <TableRow className="bg-[var(--fill-quaternary)] border-none hover:bg-[var(--fill-quaternary)]">
                                            <TableHead className="w-[210px] h-9 py-2 text-[11px] uppercase tracking-wide" style={{ color: "var(--label-tertiary)" }}>Name</TableHead>
                                            <TableHead className="h-9 py-2 text-[11px] uppercase tracking-wide" style={{ color: "var(--label-tertiary)" }}>Module</TableHead>
                                            <TableHead className="h-9 py-2 text-[11px] uppercase tracking-wide" style={{ color: "var(--label-tertiary)" }}>Email</TableHead>
                                            <TableHead className="h-9 py-2 text-[11px] uppercase tracking-wide" style={{ color: "var(--label-tertiary)" }}>Phone</TableHead>
                                            <TableHead className="h-9 py-2 text-[11px] uppercase tracking-wide" style={{ color: "var(--label-tertiary)" }}>Property</TableHead>
                                            <TableHead className="h-9 py-2 text-[11px] uppercase tracking-wide" style={{ color: "var(--label-tertiary)" }}>Channels</TableHead>
                                            <TableHead className="h-9 py-2 text-[11px] uppercase tracking-wide" style={{ color: "var(--label-tertiary)" }}>Stage</TableHead>
                                            <TableHead className="h-9 py-2 text-[11px] uppercase tracking-wide" style={{ color: "var(--label-tertiary)" }}>Reply</TableHead>
                                            <TableHead className="w-[200px] h-9 py-2 text-[11px] uppercase tracking-wide" style={{ color: "var(--label-tertiary)" }}>Progress</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading && leads.length === 0 ? (
                                            <TableRow className="border-none hover:bg-transparent">
                                                <TableCell colSpan={9} className="h-24 text-center">
                                                    <div className="flex items-center justify-center gap-2 text-[var(--label-secondary)]">
                                                        <Loader2 className="h-4 w-4 animate-spin" /> Loading leads...
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredLeads.length === 0 ? (
                                            <TableRow className="border-none hover:bg-transparent">
                                                <TableCell colSpan={9} className="h-24 text-center text-[var(--label-secondary)]">No leads matching these filters.</TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredLeads.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((lead, index) => {
                                                const displayName = lead.full_name || [lead.first_name, lead.last_name].filter(Boolean).join(" ") || lead.name;
                                                const pill = { display: "inline-flex", alignItems: "center", padding: "1px 7px", borderRadius: "var(--radius-sm)", fontSize: 10, fontWeight: 700, textTransform: "capitalize" as const, lineHeight: "16px" };
                                                return (
                                                <TableRow key={lead.lead_id || index} className="hover:bg-[var(--fill-quaternary)] border-b border-[var(--separator)] transition-colors">
                                                    <TableCell className="font-medium text-[var(--label-primary)] py-2 align-middle">
                                                        <div className="text-[13px] leading-tight">{displayName}</div>
                                                        {(lead.company_name || lead.crm_name || lead.crm_id) && (
                                                            <div className="text-[10.5px] text-[var(--label-tertiary)] font-normal leading-tight truncate max-w-[210px]">
                                                                {[lead.company_name, lead.crm_name].filter(Boolean).join(" · ")}
                                                                {(lead.company_name || lead.crm_name) && lead.crm_id ? " · " : ""}
                                                                {lead.crm_id && <span className="font-mono">{lead.crm_id}</span>}
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="py-2 align-middle">
                                                        {lead.module_name
                                                            ? <span style={{ ...pill, background: "color-mix(in srgb, var(--indigo) 12%, transparent)", color: "var(--indigo)" }}>{lead.module_name}</span>
                                                            : <span className="text-[var(--label-tertiary)]">—</span>}
                                                    </TableCell>
                                                    <TableCell className={`text-[12px] py-2 align-middle max-w-[220px] truncate ${lead.email === "No Email" ? "text-[var(--label-tertiary)] italic" : "text-[var(--label-secondary)]"}`}>
                                                        {lead.email}
                                                    </TableCell>
                                                    <TableCell className="text-[var(--label-secondary)] text-[12px] py-2 align-middle whitespace-nowrap">{lead.phone || "—"}</TableCell>
                                                    <TableCell className="py-2 align-middle">
                                                        <div className="flex flex-wrap gap-1">
                                                            {lead.property_type && <span style={{ ...pill, background: "color-mix(in srgb, var(--purple) 12%, transparent)", color: "var(--purple)" }}>{lead.property_type}</span>}
                                                            {lead.property_category && <span style={{ ...pill, background: "color-mix(in srgb, var(--orange) 12%, transparent)", color: "var(--orange)" }}>{lead.property_category}</span>}
                                                            {!lead.property_type && !lead.property_category && <span className="text-[var(--label-tertiary)]">—</span>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2 align-middle">
                                                        <div className="flex items-center gap-1.5">
                                                            {lead.email && lead.email !== "No Email" && <Mail className="h-3.5 w-3.5 text-[var(--blue)]" aria-label="Email" />}
                                                            {lead.phone && <MessageCircle className="h-3.5 w-3.5 text-[var(--green)]" aria-label="WhatsApp" />}
                                                            {lead.call_slots.length > 0 && <Phone className="h-3.5 w-3.5 text-[var(--purple)]" aria-label="Voice" />}
                                                            {!(lead.email && lead.email !== "No Email") && !lead.phone && lead.call_slots.length === 0 && <span className="text-[var(--label-tertiary)]">—</span>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2 align-middle">
                                                        <span style={{ ...pill, textTransform: "uppercase", letterSpacing: "0.04em", background: "color-mix(in srgb, var(--blue) 12%, transparent)", color: "var(--blue)", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block" }}>
                                                            {lead.lead_stage || lead.lead_status || "—"}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="py-2 align-middle">
                                                        <span style={{ ...pill, background: lead.replied === "Yes" ? "color-mix(in srgb, var(--green) 12%, transparent)" : "var(--fill-secondary)", color: lead.replied === "Yes" ? "var(--green)" : "var(--label-secondary)" }}>
                                                            {lead.replied === "Yes" ? "Replied" : "Sent"}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="py-2 align-middle"><ProgressBreakdown lead={lead} /></TableCell>
                                                </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            <PaginationFooter totalItems={filteredLeads.length} currentPage={currentPage} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
                        </>
                    ) : (
                        <div className="p-6 space-y-6">
                            <div className="flex justify-center">
                                <div className="bg-[var(--fill-tertiary)] p-1 rounded-lg inline-flex items-center gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => setTemplateFilter("email")} className={`text-xs h-8 px-4 rounded-md transition-all ${templateFilter === "email" ? "bg-[var(--bg-layer1)] text-[var(--label-primary)] shadow-sm font-semibold" : "text-[var(--label-secondary)] hover:text-[var(--label-primary)]"}`}>Email Templates</Button>
                                    <Button variant="ghost" size="sm" onClick={() => setTemplateFilter("whatsapp")} className={`text-xs h-8 px-4 rounded-md transition-all ${templateFilter === "whatsapp" ? "bg-[var(--bg-layer1)] text-[var(--label-primary)] shadow-sm font-semibold" : "text-[var(--label-secondary)] hover:text-[var(--label-primary)]"}`}>WhatsApp Templates</Button>
                                </div>
                            </div>
                            {templates.filter(t => t.type === templateFilter).length === 0 ? (
                                <div className="text-center text-[var(--label-secondary)] py-10">No {templateFilter} templates found.</div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 gap-6 max-w-4xl mx-auto">
                                        {templates.filter(t => t.type === templateFilter).slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((template: any, idx) => (
                                            <div key={template.id || idx} className="liquid-card border-none overflow-hidden" style={{ padding: 0 }}>
                                                <div style={{ background: "var(--fill-quaternary)", borderBottom: "1px solid var(--separator)", padding: "12px 16px", display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-md ${template.type === "email" ? "bg-[var(--blue)]/10 text-[var(--blue)]" : "bg-[var(--green)]/10 text-[var(--green)]"}`}>
                                                            {template.type === "email" ? <Mail className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                                                        </div>
                                                        <div className="font-semibold text-[var(--label-primary)]">{template.name || `Template ${idx + 1}`}</div>
                                                    </div>
                                                    {template.category && (
                                                        <Badge variant="secondary" className="text-xs bg-[var(--fill-secondary)] border border-[var(--glass-border)] text-[var(--label-secondary)] shadow-none">{template.category}</Badge>
                                                    )}
                                                </div>
                                                <div className="p-6 bg-transparent">
                                                    <div className="whitespace-pre-wrap text-[var(--label-secondary)] font-sans leading-relaxed">
                                                        {typeof template.body === "string" ? template.body : JSON.stringify(template, null, 2)}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <PaginationFooter totalItems={templates.filter(t => t.type === templateFilter).length} currentPage={currentPage} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function PaginationFooter({ totalItems, currentPage, itemsPerPage, onPageChange }: any) {
    if (totalItems <= itemsPerPage) return null;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    return (
        <div className="px-6 py-4 border-t border-[var(--separator)] bg-[var(--fill-quaternary)] flex items-center justify-between">
            <p className="text-sm text-[var(--label-secondary)]">
                Showing <span className="font-bold text-[var(--label-primary)]">{totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}-{Math.min(currentPage * itemsPerPage, totalItems)}</span> of {totalItems} items
            </p>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-[var(--glass-border)] bg-[var(--fill-tertiary)] hover:bg-[var(--fill-secondary)] text-[var(--label-primary)]" onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) pageNum = i + 1;
                        else if (currentPage <= 3) pageNum = i + 1;
                        else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                        else pageNum = currentPage - 2 + i;
                        const isActive = currentPage === pageNum;
                        return (
                            <Button key={pageNum} variant={isActive ? "default" : "outline"} size="sm" className={`h-8 w-8 p-0 text-xs ${isActive ? "bg-[var(--blue)] text-white hover:bg-[var(--blue)]/90" : "border-[var(--glass-border)] bg-[var(--fill-tertiary)] hover:bg-[var(--fill-secondary)] text-[var(--label-primary)]"}`} onClick={() => onPageChange(pageNum)}>
                                {pageNum}
                            </Button>
                        );
                    })}
                </div>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-[var(--glass-border)] bg-[var(--fill-tertiary)] hover:bg-[var(--fill-secondary)] text-[var(--label-primary)]" onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
