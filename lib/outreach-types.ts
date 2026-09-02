// ─────────────────────────────────────────────────────────────────────────────
// New data layer — single source of truth is public.outreach_table
// (+ public.vapi_call_logs for voice). No more nr_wf / nurture / followup loops.
// ─────────────────────────────────────────────────────────────────────────────

/** One WhatsApp slot on outreach_table (wa_1 .. wa_4). */
export interface WaSlot {
    n: number;
    message: string | null;
    status: string | null;
    sent_at: string | null;
}

/** One email slot on outreach_table (email_1 .. email_5). */
export interface EmailSlot {
    n: number;
    /** raw column value — may be plain text or JSON-encoded object */
    raw: any;
    /** best-effort readable body */
    body: string;
    /** parsed object when the column holds JSON ({subject, from, to, body_html, ...}) */
    obj: Record<string, any> | null;
    status: string | null;
    sent_at: string | null;
}

/** One call slot derived from outreach_table's call_N_* columns. */
export interface CallSlot {
    n: number;
    date: string | null;
    status: string | null;
    sentiment: string | null;
    note: string | null;
    recording_url: string | null;
}

/**
 * Normalised lead shape used by every dashboard page. Mirrors outreach_table
 * columns 1:1 where it matters, plus a few derived convenience fields.
 */
export interface OutreachLead {
    // identity
    lead_id: string;
    crm_id: string | null;
    id: string;                // alias of lead_id, kept for legacy component props

    // contact
    full_name: string;
    first_name: string | null;
    last_name: string | null;
    name: string;              // alias of full_name for legacy components
    company_name: string | null;
    designation: string | null;
    email: string;
    phone: string;

    // ownership / status
    owner_name: string | null;
    owner_email: string | null;
    lead_status: string | null;
    lead_stage: string | null;
    lead_pipeline: string | null;
    pipeline: string | null;
    rating: string | null;
    lead_source: string | null;

    // property
    property_type: string | null;
    property_category: string | null;
    property_sub_category: string | null;
    requirement: string | null;
    budget: number | null;

    // ai
    ai_score: number | null;
    ai_summary: string | null;
    ai_intent: string | null;
    ai_sentiment: string | null;
    ai_priority: string | null;

    // workflow
    workflow_name: string | null;
    workflow_status: string | null;
    current_step: number | null;
    next_followup_date: string | null;
    wf_error: string | null;

    // ── WhatsApp ──
    wa_slots: WaSlot[];
    wa_sentiment: string | null;
    wa_note: string | null;
    last_whatsapp_message: string | null;
    whatsapp_conversation: any[];
    whatsapp_reply_track: string | null;
    whatsapp_replied: boolean;

    // ── Email ──
    email_slots: EmailSlot[];
    email_sentiment: string | null;
    email_note: string | null;
    email_conversation: any[];
    email_reply_track: string | null;
    email_replied: boolean;

    // ── Calls ──
    call_slots: CallSlot[];
    call_reply_track: string | null;
    call_route: string | null;
    call_replied: boolean;

    // activity / audit
    replied: string;           // "Yes" | "No" — any-channel reply
    last_activity: string | null;
    created_time: string | null;
    created_at: string | null;
    updated_at: string | null;

    // everything else, verbatim
    raw: Record<string, any>;
    [key: string]: any;
}

export const OUTREACH_TABLE = 'outreach_table';
export const VAPI_CALL_LOGS = 'vapi_call_logs';

/** Columns we pull for list/detail views. `*` is used in practice; this list
 * documents intent and is handy for narrow metric queries. */
export const OUTREACH_LIST_COLUMNS = [
    'lead_id', 'crm_id', 'full_name', 'first_name', 'last_name', 'company_name',
    'designation', 'email', 'phone', 'owner_name', 'owner_email',
    'lead_status', 'lead_stage', 'lead_pipeline', 'pipeline', 'rating', 'lead_source',
    'property_type', 'property_category', 'property_sub_category', 'requirement', 'budget',
    'ai_score', 'ai_summary', 'ai_intent', 'ai_sentiment', 'ai_priority',
    'workflow_name', 'workflow_status', 'current_step', 'next_followup_date', 'wf_error',
    'wa_1', 'wa_1_status', 'wa_1_sent_at',
    'wa_2', 'wa_2_status', 'wa_2_sent_at',
    'wa_3', 'wa_3_status', 'wa_3_sent_at',
    'wa_4', 'wa_4_status', 'wa_4_sent_at',
    'wa_sentiment', 'wa_note', 'last_whatsapp_message', 'whatsapp_conversation', 'whatsapp_reply_track',
    'email_1', 'email_1_status', 'email_1_sent_at',
    'email_2', 'email_2_status', 'email_2_sent_at',
    'email_3', 'email_3_status', 'email_3_sent_at',
    'email_4', 'email_4_status', 'email_4_sent_at',
    'email_5', 'email_5_status', 'email_5_sent_at',
    'email_sentiment', 'email_note', 'email_conversation', 'email_reply_track',
    'call_1_date', 'call_1_status', 'call_1_sentiment', 'call_1_note', 'call_recording_1',
    'call_2_date', 'call_2_status', 'call_2_sentiment', 'call_2_note', 'call_recording_2',
    'call_3_date', 'call_3_status', 'call_3_sentiment', 'call_3_note', 'call_recording_3',
    'call_4_date', 'call_4_status', 'call_4_sentiment', 'call_4_note', 'call_recording_4',
    'call_reply_track', 'call_route',
    'replied', 'last_activity', 'created_time', 'created_at', 'updated_at',
].join(',');

// ─── small shared helpers ────────────────────────────────────────────────────

/** A tracking string counts as "replied" unless it's empty / "no" / "none". */
export function isReplyTrackPositive(v: any): boolean {
    if (v === undefined || v === null) return false;
    const s = String(v).trim().toLowerCase();
    return s !== '' && s !== 'no' && s !== 'none' && s !== 'false';
}

export function parseJsonArray(raw: any): any[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
        try {
            const p = JSON.parse(raw);
            return Array.isArray(p) ? p : [];
        } catch {
            return [];
        }
    }
    return [];
}

export function parseJsonObject(raw: any): Record<string, any> | null {
    if (!raw) return null;
    let parsed = raw;
    for (let i = 0; i < 5; i++) {
        if (typeof parsed === 'string') {
            try { parsed = JSON.parse(parsed); } catch { break; }
        } else break;
    }
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) return parsed;
    return null;
}

/** Pull a usable timestamp out of a `_sent_at` column or an email JSON object. */
export function coerceTimestamp(v: any): string | null {
    if (!v) return null;
    const s = String(v).trim();
    if (!s) return null;
    // "SENT | 2026-06-29T18:24:50.000Z"
    if (s.includes('|')) {
        const part = s.split('|').pop()?.trim();
        if (part && !isNaN(new Date(part).getTime())) return part;
    }
    if (!isNaN(new Date(s).getTime())) return s;
    return null;
}
