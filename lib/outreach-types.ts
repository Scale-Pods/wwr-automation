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
    crm_name: string | null;
    module_name: string | null;
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

const OUTBOUND_ROLES = new Set(['assistant', 'bot', 'agent', 'system', 'ai', 'b2b_ai']);
const INBOUND_ROLES = new Set(['user', 'customer', 'client', 'lead', 'contact', 'human']);

/** Is one whatsapp_conversation / email_conversation entry an outbound (our-side) message? */
export function isOutboundMessage(m: any): boolean {
    const r = String(m?.role ?? m?.type ?? m?.sender ?? m?.direction ?? '').toLowerCase();
    if (OUTBOUND_ROLES.has(r)) return true;
    if (INBOUND_ROLES.has(r)) return false;
    // No usable role — the pipeline always stamps role:assistant on our side,
    // so an unlabelled entry is treated as inbound.
    return false;
}

export function isInboundMessage(m: any): boolean {
    const r = String(m?.role ?? m?.type ?? m?.sender ?? m?.direction ?? '').toLowerCase();
    if (INBOUND_ROLES.has(r)) return true;
    if (OUTBOUND_ROLES.has(r)) return false;
    return !r; // unlabelled → inbound
}

/**
 * Count of outbound WhatsApp messages for one outreach_table row.
 * The number of outbound bubbles in whatsapp_conversation, but never less than
 * the count of populated wa_1..wa_3 slots (a lead that was messaged always
 * counts at least those sends, even if the conversation only stored replies).
 */
export function waMessagesSent(row: any): number {
    const outbound = parseJsonArray(row?.whatsapp_conversation).filter(isOutboundMessage).length;
    let slots = 0;
    for (let n = 1; n <= 4; n++) if (row?.[`wa_${n}`]) slots++;
    return Math.max(outbound, slots);
}

/**
 * The wa_1..wa_3 slots that are a genuine outbound send: wa_N is not null AND
 * wa_N_status is "sent". Returns the slot metadata (with its sent_at) so callers
 * can date-scope on wa_N_sent_at.
 */
export function waSentSlots(row: any): { n: number; message: string; status: string; sent_at: string | null }[] {
    const out: { n: number; message: string; status: string; sent_at: string | null }[] = [];
    for (let n = 1; n <= 3; n++) {
        const message = row?.[`wa_${n}`];
        const status = String(row?.[`wa_${n}_status`] ?? '').trim().toLowerCase();
        if (message != null && String(message).trim() !== '' && status === 'sent') {
            out.push({ n, message: String(message), status: 'sent', sent_at: row?.[`wa_${n}_sent_at`] ?? null });
        }
    }
    return out;
}

/** True when a lead has at least one wa_1..wa_3 slot that was actually sent. */
export function hasWaSend(row: any): boolean {
    return waSentSlots(row).length > 0;
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

/**
 * Parse a "DD/MM/YYYY HH:MM[:SS]" or "DD-MM-YYYY HH:MM[:SS]" string (optionally
 * with a comma after the date). These come from the WhatsApp pipeline's
 * `wa_N_sent_at` columns and `qatar_timestamp` fields, and are Asia/Qatar local
 * time (UTC+03:00, no DST). Returns an ISO string, or null if it doesn't match.
 */
export function parseQatarDateTime(v: any): string | null {
    if (!v) return null;
    const m = String(v).trim().match(
        /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:,)?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/
    );
    if (!m) return null;
    const [, dd, mm, yyyy, hh, min, ss] = m;
    const iso = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T` +
        `${hh.padStart(2, '0')}:${min}:${(ss ?? '00').padStart(2, '0')}+03:00`;
    return isNaN(new Date(iso).getTime()) ? null : iso;
}

/** Pull a usable timestamp out of a `_sent_at` column, a JSON message, or a
 *  "DD/MM/YYYY HH:MM" pipeline string. Returns an ISO string or null. */
export function coerceTimestamp(v: any): string | null {
    if (!v) return null;
    const s = String(v).trim();
    if (!s) return null;
    // "SENT | 2026-06-29T18:24:50.000Z"
    if (s.includes('|')) {
        const part = s.split('|').pop()?.trim();
        if (part) {
            const q = parseQatarDateTime(part);
            if (q) return q;
            if (!isNaN(new Date(part).getTime())) return part;
        }
    }
    // "08/09/2026 17:22" / "08/09/2026, 17:12:08" — try this BEFORE Date() so
    // it isn't mis-parsed as MM/DD.
    const q = parseQatarDateTime(s);
    if (q) return q;
    if (!isNaN(new Date(s).getTime())) return s;
    return null;
}
