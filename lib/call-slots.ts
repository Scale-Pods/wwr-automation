/**
 * Maps a call (by start time) to the outreach_table call slot (1..8) that holds
 * its sentiment / note. Slots are matched by date: the slot whose call_N_date is
 * closest to the call start (within 36h) and that actually holds a result.
 * Dialer placeholder dates on empty slots are ignored because they have no data.
 */
export interface CallSlotResult {
    slot: number;
    sentiment: string | null;
    note: string | null;
}

const MAX_GAP_MS = 36 * 3600000;

function slotTime(raw: unknown): number | null {
    if (!raw) return null;
    const s = String(raw);
    const t = new Date(s.length <= 10 ? `${s}T00:00:00+03:00` : s).getTime();
    return isNaN(t) ? null : t;
}

export function slotForCall(lead: Record<string, any> | null | undefined, startedAt: string | null | undefined): CallSlotResult | null {
    if (!lead) return null;
    const ct = startedAt ? new Date(startedAt).getTime() : NaN;
    let best: { n: number; diff: number } | null = null;
    let firstWithData: number | null = null;
    let slotsWithData = 0;
    for (let n = 1; n <= 8; n++) {
        const sentiment = lead[`call_${n}_sentiment`];
        const note = lead[`call_${n}_note`];
        if (!sentiment && !note) continue;
        if (firstWithData === null) firstWithData = n;
        slotsWithData++;
        const t = slotTime(lead[`call_${n}_date`]);
        if (t === null || isNaN(ct)) continue;
        const diff = Math.abs(t - ct);
        if (diff <= MAX_GAP_MS && (!best || diff < best.diff)) best = { n, diff };
    }
    // Legacy rows with no usable slot date: if the lead has exactly one result
    // slot, that is unambiguous; otherwise show nothing rather than a wrong call's.
    let n: number | null = best ? best.n : null;
    if (n === null && firstWithData !== null && slotsWithData === 1 && slotTime(lead[`call_${firstWithData}_date`]) === null) n = firstWithData;
    if (n === null) return null;
    return { slot: n, sentiment: lead[`call_${n}_sentiment`] || null, note: lead[`call_${n}_note`] || null };
}
