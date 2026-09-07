// ─────────────────────────────────────────────────────────────────────────────
// Normalisation layer for the new single-table schema (public.outreach_table).
//
// The exported names (consolidateLeads / ConsolidatedLead / RawLeadsResponse)
// are kept so existing imports across the app keep working, but everything now
// maps outreach_table rows -> OutreachLead.
// ─────────────────────────────────────────────────────────────────────────────

import {
    OutreachLead, WaSlot, EmailSlot, CallSlot,
    isReplyTrackPositive, parseJsonArray, parseJsonObject, coerceTimestamp,
} from './outreach-types';

/** Kept for backwards-compat with old callers. Only `outreach` is read now. */
export interface RawLeadsResponse {
    outreach?: any[];
    // legacy keys — accepted but ignored
    nr_wf?: any[];
    followup?: any[];
    nurture?: any[];
    master_leads?: any[];
}

export type ConsolidatedLead = OutreachLead;

function str(v: any): string {
    return v === undefined || v === null ? '' : String(v);
}

function num(v: any): number | null {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
}

function buildWaSlots(r: any): WaSlot[] {
    const slots: WaSlot[] = [];
    for (let n = 1; n <= 4; n++) {
        const message = r[`wa_${n}`] ?? null;
        const status = r[`wa_${n}_status`] ?? null;
        const sent_at = r[`wa_${n}_sent_at`] ?? null;
        if (message || status || sent_at) slots.push({ n, message, status, sent_at });
    }
    return slots;
}

function buildEmailSlots(r: any): EmailSlot[] {
    const slots: EmailSlot[] = [];
    for (let n = 1; n <= 5; n++) {
        const raw = r[`email_${n}`];
        // email_N itself must have content — a _status/_sent_at with no body is not
        // a sent email (e.g. a scheduled-but-not-yet-sent row, or stale metadata).
        if (raw === undefined || raw === null || raw === '') continue;
        const status = r[`email_${n}_status`] ?? null;
        const sent_at = r[`email_${n}_sent_at`] ?? null;
        const obj = parseJsonObject(raw);
        const body = obj
            ? (obj.body_html || obj.body_text || obj.body || obj.content || obj.text || obj.subject || '')
            : str(raw);
        slots.push({ n, raw, body, obj, status, sent_at });
    }
    return slots;
}

function buildCallSlots(r: any): CallSlot[] {
    const slots: CallSlot[] = [];
    for (let n = 1; n <= 4; n++) {
        const date = r[`call_${n}_date`] ?? null;
        const status = r[`call_${n}_status`] ?? null;
        const sentiment = r[`call_${n}_sentiment`] ?? null;
        const note = r[`call_${n}_note`] ?? null;
        const recording_url = r[`call_recording_${n}`] ?? null;
        if (date || status || sentiment || note || recording_url) {
            slots.push({ n, date, status, sentiment, note, recording_url });
        }
    }
    return slots;
}

/** Turn one outreach_table row into an OutreachLead. */
export function normalizeOutreachRow(r: any): OutreachLead {
    const leadId = str(r.lead_id || r.crm_id || crypto?.randomUUID?.() || Math.random().toString(36).slice(2));
    const fullName = str(r.full_name || [r.first_name, r.last_name].filter(Boolean).join(' ') || r.owner_name || 'Lead').trim() || 'Lead';

    const waSlots = buildWaSlots(r);
    const emailSlots = buildEmailSlots(r);
    const callSlots = buildCallSlots(r);

    const whatsappConversation = parseJsonArray(r.whatsapp_conversation);
    const emailConversation = parseJsonArray(r.email_conversation);

    const waReplied = isReplyTrackPositive(r.whatsapp_reply_track)
        || whatsappConversation.some((m: any) => {
            const role = m?.role || m?.type || m?.sender;
            return role === 'user' || role === 'User' || role === 'customer';
        });

    const emailReplied = isReplyTrackPositive(r.email_reply_track)
        || emailConversation.some((m: any) => {
            const role = m?.role || m?.direction || m?.type;
            return role === 'user' || role === 'inbound' || role === 'received';
        });

    const callReplied = isReplyTrackPositive(r.call_reply_track);

    const anyReplied = String(r.replied || '').trim().toLowerCase() === 'yes'
        || waReplied || emailReplied || callReplied;

    return {
        lead_id: leadId,
        crm_id: r.crm_id ?? null,
        crm_name: r.crm_name ?? null,
        module_name: r.module_name ?? null,
        id: leadId,

        full_name: fullName,
        first_name: r.first_name ?? null,
        last_name: r.last_name ?? null,
        name: fullName,
        company_name: r.company_name ?? null,
        designation: r.designation ?? null,
        email: str(r.email) || 'No Email',
        phone: str(r.phone),

        owner_name: r.owner_name ?? null,
        owner_email: r.owner_email ?? null,
        lead_status: r.lead_status ?? null,
        lead_stage: r.lead_stage ?? null,
        lead_pipeline: r.lead_pipeline ?? null,
        pipeline: r.pipeline ?? r.lead_pipeline ?? null,
        rating: r.rating ?? null,
        lead_source: r.lead_source ?? null,

        property_type: r.property_type ?? null,
        property_category: r.property_category ?? null,
        property_sub_category: r.property_sub_category ?? null,
        requirement: r.requirement ?? null,
        budget: num(r.budget),

        ai_score: num(r.ai_score),
        ai_summary: r.ai_summary ?? null,
        ai_intent: r.ai_intent ?? null,
        ai_sentiment: r.ai_sentiment ?? null,
        ai_priority: r.ai_priority ?? null,

        workflow_name: r.workflow_name ?? null,
        workflow_status: r.workflow_status ?? null,
        current_step: num(r.current_step),
        next_followup_date: r.next_followup_date ?? null,
        wf_error: r.wf_error ?? null,

        wa_slots: waSlots,
        wa_sentiment: r.wa_sentiment ?? null,
        wa_note: r.wa_note ?? null,
        last_whatsapp_message: r.last_whatsapp_message ?? null,
        whatsapp_conversation: whatsappConversation,
        whatsapp_reply_track: r.whatsapp_reply_track ?? null,
        whatsapp_replied: waReplied,

        email_slots: emailSlots,
        email_sentiment: r.email_sentiment ?? null,
        email_note: r.email_note ?? null,
        email_conversation: emailConversation,
        email_reply_track: r.email_reply_track ?? null,
        email_replied: emailReplied,

        call_slots: callSlots,
        call_reply_track: r.call_reply_track ?? null,
        call_route: r.call_route ?? null,
        call_replied: callReplied,

        replied: anyReplied ? 'Yes' : 'No',
        last_activity: r.last_activity ?? null,
        created_time: r.created_time ?? null,
        created_at: r.created_at ?? r.created_time ?? null,
        updated_at: r.updated_at ?? null,

        raw: r,
    };
}

/**
 * Accepts either the new `{ outreach: [...] }` payload or a bare array of
 * outreach_table rows and returns normalised leads.
 */
export function consolidateLeads(data: RawLeadsResponse | any[]): OutreachLead[] {
    const rows: any[] = Array.isArray(data)
        ? data
        : (data?.outreach || data?.nr_wf || []);   // nr_wf accepted only as a legacy alias
    if (!Array.isArray(rows)) return [];
    return rows.map(normalizeOutreachRow);
}

// ─── convenience selectors used by pages ─────────────────────────────────────

export function emailsSentCount(lead: OutreachLead): number {
    // email_slots only contains slots where email_N itself has content (see buildEmailSlots).
    return lead.email_slots.length;
}

export function waMessagesSentCount(lead: OutreachLead): number {
    if (lead.whatsapp_conversation.length > 0) {
        return lead.whatsapp_conversation.filter((m: any) => {
            const role = m?.role || m?.type || m?.sender;
            return role === 'assistant' || role === 'bot' || role === 'agent';
        }).length || lead.wa_slots.length;
    }
    return lead.wa_slots.filter(s => s.message != null || s.sent_at || s.status).length;
}

export function callsMadeCount(lead: OutreachLead): number {
    return lead.call_slots.filter(s => s.date || s.status).length;
}

export function latestEmailSentAt(lead: OutreachLead): string | null {
    let latest: string | null = null;
    for (const s of lead.email_slots) {
        const ts = coerceTimestamp(s.sent_at) || coerceTimestamp(s.obj?.timestamp);
        if (ts && (!latest || ts > latest)) latest = ts;
    }
    return latest;
}

export function latestWaSentAt(lead: OutreachLead): string | null {
    let latest: string | null = null;
    for (const s of lead.wa_slots) {
        const ts = coerceTimestamp(s.sent_at);
        if (ts && (!latest || ts > latest)) latest = ts;
    }
    return latest;
}
