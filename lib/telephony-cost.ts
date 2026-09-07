import RATES_DATA from "@/context/rates.json";

export interface RateEntry {
    Type: string | null;
    Category: string | null;
    Country: string | null;
    Specifier: string | null;
    Prefix: number | string;
    Rate: number;
}

const RATES: RateEntry[] = (RATES_DATA as unknown as RateEntry[]) || [];

// Longest-prefix-first so 91979 beats 919 beats 91 when matching an Indian number.
const RATES_BY_PREFIX_DESC = [...RATES].sort(
    (a, b) => String(b.Prefix).length - String(a.Prefix).length
);

/** Digits only, no leading +, empty string for anything unusable. */
export function normalizeDigits(num: unknown): string {
    const s = String(num ?? "").replace(/[^\d]/g, "");
    if (!s || s.length < 5 || s.length > 22) return "";
    return s;
}

/** The rates.json row whose Prefix is the longest match for this number. */
export function lookupRate(phone: unknown): RateEntry | null {
    const digits = normalizeDigits(phone);
    if (!digits) return null;
    for (const entry of RATES_BY_PREFIX_DESC) {
        if (digits.startsWith(String(entry.Prefix))) return entry;
    }
    return null;
}

export function countryOf(phone: unknown): string {
    return lookupRate(phone)?.Country || "Unknown";
}

/** Dialling code we matched on, e.g. "+91". Empty when unknown. */
export function dialCodeOf(phone: unknown): string {
    const p = lookupRate(phone)?.Prefix;
    return p != null ? `+${p}` : "";
}

const INBOUND_PER_MINUTE = 0.02;
const US_UK_TO_UAE_PER_MINUTE = 0.2995;

/**
 * Telephony (carrier) cost for one call, in USD. Billed per started minute.
 *
 * - Inbound: flat {@link INBOUND_PER_MINUTE}/min once there's any duration.
 * - Outbound from a US/UK bot number to a UAE customer: the {@link US_UK_TO_UAE_PER_MINUTE}
 *   backup rate (rates.json has no US→UAE row).
 * - Otherwise: the matched rates.json Rate/min; 0 when no prefix matches.
 */
export function telephonyCost(opts: {
    durationSeconds: number;
    customerPhone: unknown;
    botPhone?: unknown;
    isInbound?: boolean;
}): number {
    const { durationSeconds, customerPhone, botPhone, isInbound } = opts;
    const secs = Number(durationSeconds) || 0;
    if (secs <= 0) return 0;

    const minutes = Math.ceil(secs / 60);

    if (isInbound) return round4(minutes * INBOUND_PER_MINUTE);

    const bot = normalizeDigits(botPhone);
    const cust = normalizeDigits(customerPhone);
    const botIsUS = bot.startsWith("1");
    const botIsUK = bot.startsWith("44");
    const custIsUAE = cust.startsWith("971");
    if ((botIsUS || botIsUK) && custIsUAE) {
        return round4(minutes * US_UK_TO_UAE_PER_MINUTE);
    }

    const rate = lookupRate(customerPhone)?.Rate;
    if (!rate) return 0;
    return round4(minutes * rate);
}

function round4(n: number): number {
    return Math.round(n * 1e4) / 1e4;
}
