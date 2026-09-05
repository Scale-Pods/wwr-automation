// ─────────────────────────────────────────────────────────────────────────────
// Board bifurcation for the email panel: combine module_name (Deals / Leads)
// with lead_pipeline (Brokerage / Bizsouq / Business Center) into one filter key.
// ─────────────────────────────────────────────────────────────────────────────

import type { OutreachLead } from "./outreach-types";

export type EmailBoardKey =
    | "all"
    | "deals-brokerage"
    | "deals-bizsouq"
    | "deals-business-center"
    | "leads";

export const EMAIL_BOARD_OPTIONS: { key: EmailBoardKey; label: string }[] = [
    { key: "all", label: "All Boards" },
    { key: "deals-brokerage", label: "Deals – Brokerage" },
    { key: "deals-bizsouq", label: "Deals – Bizsouq" },
    { key: "deals-business-center", label: "Deals – Business Center" },
    { key: "leads", label: "Leads" },
];

const norm = (v: any) => String(v ?? "").trim().toLowerCase();

/** Map one lead to its board key. `module_name` decides Deals vs Leads;
 *  `lead_pipeline` (or `pipeline`) decides which Deals board. */
export function boardOf(lead: OutreachLead | any): Exclude<EmailBoardKey, "all"> {
    const mod = norm(lead?.raw?.module_name ?? lead?.module_name);
    if (mod === "leads" || mod === "lead") return "leads";

    // Deals module (or unknown) — sub-classify by pipeline.
    const pipe = norm(lead?.lead_pipeline ?? lead?.pipeline ?? lead?.raw?.lead_pipeline ?? lead?.raw?.pipeline);

    // "Sales" is the Zoho API value for the Brokerage pipeline (see call-sentiment workflow).
    if (pipe.includes("brokerage") || pipe === "sales" || pipe.includes("broker")) return "deals-brokerage";
    if (pipe.includes("bizsouq") || pipe.includes("bizsoug") || pipe.includes("bizscouq") || pipe.includes("biz souq")) return "deals-bizsouq";
    if (pipe.includes("business center") || pipe.includes("business centre") || pipe === "bc" || pipe === "wwbc") return "deals-business-center";

    // module is Deals-ish but pipeline unrecognised → default to Brokerage bucket.
    if (mod === "deals" || mod === "deal") return "deals-brokerage";

    // No module and no recognisable pipeline → treat as Leads.
    return "leads";
}

/** True if `lead` belongs to the selected board (or "all"). */
export function matchesBoard(lead: OutreachLead | any, selected: EmailBoardKey): boolean {
    if (selected === "all") return true;
    return boardOf(lead) === selected;
}

export function boardLabel(key: EmailBoardKey): string {
    return EMAIL_BOARD_OPTIONS.find(o => o.key === key)?.label ?? "All Boards";
}
