/**
 * PostgREST filter for vapi_call_logs rows inside [fromISO, toISO]. A few logs have
 * no started_at (the webhook never set it), so fall back to created_at for those —
 * otherwise they vanish from every date-filtered view.
 */
export function callDateFilter(fromISO: string | null, toISO: string | null): string {
    const parts: string[] = [];
    const main: string[] = [];
    const nul: string[] = ['started_at.is.null'];
    if (fromISO) { main.push(`started_at.gte.${fromISO}`); nul.push(`created_at.gte.${fromISO}`); }
    if (toISO) { main.push(`started_at.lte.${toISO}`); nul.push(`created_at.lte.${toISO}`); }
    if (!main.length) return '';
    parts.push(`and(${main.join(',')})`, `and(${nul.join(',')})`);
    return `&or=(${parts.join(',')})`;
}

/** Row's effective start time: started_at, else created_at. */
export function callStart<T extends { started_at?: string | null; created_at?: string | null }>(r: T): string | null {
    return r.started_at || r.created_at || null;
}
