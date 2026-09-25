"use client";

import { use, useEffect, useState } from "react";
import { Phone, Lock, ChevronDown, Clock, FileText, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { ModernAudioPlayer } from "@/components/voice/call-details-modal";
import { formatOffset, type CallTurn } from "@/lib/call-transcript";

type SharedCall = {
    id: string;
    startedAt: string | null;
    durationSeconds: number;
    summary: string;
    recordingUrl: string | null;
    transcript: CallTurn[];
    callSlot?: number;
    sentiment?: string | null;
    note?: string | null;
};

type SharedData = { name: string; phone: string | null; calls: SharedCall[] };

function formatDuration(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = Math.floor(Math.max(0, secs % 60));
    return `${m}m ${s}s`;
}

function formatDate(iso: string | null): string {
    if (!iso) return "Unknown date";
    try { return format(new Date(iso), "MMM dd, yyyy · p"); } catch { return "Unknown date"; }
}

function CallCard({ call, open, onToggle }: { call: SharedCall; open: boolean; onToggle: () => void }) {
    return (
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", background: "#fff" }}>
            <button
                onClick={onToggle}
                aria-expanded={open}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: open ? "#f8fafc" : "#fff", border: "none", cursor: "pointer", textAlign: "left" }}
            >
                <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(10,132,255,0.10)", color: "#007AFF" }}>
                    <Phone style={{ width: 15, height: 15 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", margin: 0 }}>
                        {call.callSlot ? `Call ${call.callSlot} · ` : ""}{formatDate(call.startedAt)}
                    </p>
                    <p style={{ fontSize: 11, color: "#64748b", margin: "2px 0 0", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Clock style={{ width: 10, height: 10 }} />{formatDuration(call.durationSeconds)}</span>
                        <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#cbd5e1" }} />
                        <span>{call.transcript.length} turns</span>
                    </p>
                </div>
                {call.sentiment && (
                    <span style={{
                        flexShrink: 0, display: "inline-flex", alignItems: "center", padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700, textTransform: "capitalize",
                        background: call.sentiment.toLowerCase().includes("positive") ? "rgba(34,197,94,0.12)" : call.sentiment.toLowerCase().includes("negative") ? "rgba(239,68,68,0.10)" : "rgba(148,163,184,0.14)",
                        color: call.sentiment.toLowerCase().includes("positive") ? "#16a34a" : call.sentiment.toLowerCase().includes("negative") ? "#dc2626" : "#64748b",
                    }}>{call.sentiment}</span>
                )}
                <ChevronDown style={{ width: 16, height: 16, color: "#94a3b8", flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
            </button>

            {open && (
                <div style={{ borderTop: "1px solid #e2e8f0" }}>
                    {call.summary && (
                        <div style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0", background: "rgba(10,132,255,0.04)" }}>
                            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#007AFF", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 5 }}>
                                <Sparkles style={{ width: 11, height: 11 }} /> Summary
                            </p>
                            <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "#334155", margin: 0, whiteSpace: "pre-wrap" }}>{call.summary}</p>
                        </div>
                    )}

                    {call.note && (
                        <div style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
                            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", margin: "0 0 4px" }}>
                                AI Note
                            </p>
                            <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "#334155", margin: 0, whiteSpace: "pre-wrap" }}>{call.note}</p>
                        </div>
                    )}

                    {call.recordingUrl && (
                        <div style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <ModernAudioPlayer audioUrl={call.recordingUrl} initialDuration={call.durationSeconds} />
                        </div>
                    )}

                    <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                        {call.transcript.length === 0 ? (
                            <div style={{ padding: "24px 0", textAlign: "center", color: "#94a3b8", fontSize: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                                <FileText style={{ width: 18, height: 18, opacity: 0.4 }} />
                                No transcript for this call.
                            </div>
                        ) : call.transcript.map((msg, i) => {
                            const isUser = msg.role === "user";
                            const t = formatOffset(msg.startTime);
                            return (
                                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-start" : "flex-end", width: "100%" }}>
                                    <div style={{
                                        maxWidth: "85%", padding: "8px 11px", borderRadius: 12,
                                        background: isUser ? "rgba(34,197,94,0.09)" : "#f1f5f9",
                                        border: `1px solid ${isUser ? "rgba(34,197,94,0.20)" : "#e2e8f0"}`,
                                        borderTopLeftRadius: isUser ? 3 : 12,
                                        borderTopRightRadius: isUser ? 12 : 3,
                                    }}>
                                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: isUser ? "#16a34a" : "#007AFF" }}>
                                            {isUser ? "Customer" : "Agent"}
                                        </span>
                                        <p style={{ fontSize: 13, lineHeight: 1.55, color: "#0f172a", margin: "3px 0 0", whiteSpace: "pre-wrap" }}>{msg.message}</p>
                                    </div>
                                    {t && <span style={{ fontSize: 10, color: "#94a3b8", marginTop: 3, padding: "0 2px" }}>{t}</span>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function PublicCallSharePage({ params, searchParams }: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ call?: string }>;
}) {
    const { id } = use(params);
    const { call: focusCallId } = use(searchParams);
    const decodedId = decodeURIComponent(id);

    const [data, setData] = useState<SharedData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [openIds, setOpenIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/public/call/${encodeURIComponent(decodedId)}`);
                if (!res.ok) { setError(res.status === 404 ? "Call not found" : "Failed to load call"); return; }
                const json: SharedData = await res.json();
                setData(json);
                // Open the call the link was shared from; otherwise the latest.
                const first = json.calls.find(c => c.id === focusCallId) || json.calls[0];
                if (first) setOpenIds(new Set([first.id]));
            } catch {
                setError("An error occurred");
            } finally {
                setLoading(false);
            }
        })();
    }, [decodedId, focusCallId]);

    const toggle = (cid: string) => setOpenIds(prev => {
        const next = new Set(prev);
        if (next.has(cid)) next.delete(cid); else next.add(cid);
        return next;
    });

    if (loading) {
        return (
            <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: 13 }}>
                Loading call…
            </div>
        );
    }

    if (error || !data) {
        return (
            <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "#64748b", padding: 16, textAlign: "center" }}>
                <Phone style={{ width: 40, height: 40, opacity: 0.3 }} />
                <p style={{ fontWeight: 600, color: "#475569", margin: 0 }}>{error || "Call not found"}</p>
                <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>If you believe this is an error, please contact support.</p>
            </div>
        );
    }

    // The focused call goes first; the rest stay newest-first.
    const calls = [...data.calls].sort((a, b) => (a.id === focusCallId ? -1 : b.id === focusCallId ? 1 : 0));

    return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
            <div style={{ background: "#0f172a", color: "#fff", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 12, fontWeight: 500, textAlign: "center" }}>
                <Lock style={{ width: 12, height: 12, color: "#34d399", flexShrink: 0 }} />
                <span>Secure Call Viewer • Public access restricted to this lead&apos;s calls only</span>
            </div>

            <div style={{ flex: 1, width: "100%", maxWidth: 760, margin: "0 auto", padding: "24px 16px" }}>
                <div style={{ background: "#fff", borderRadius: 20, boxShadow: "0 1px 3px rgba(15,23,42,0.06), 0 8px 28px rgba(15,23,42,0.07)", overflow: "hidden" }}>
                    <div style={{ padding: "18px 22px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(10,132,255,0.10)", color: "#007AFF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Phone style={{ width: 18, height: 18 }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <h1 style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", margin: 0 }}>{data.name || "Voice Call"}</h1>
                            <p style={{ fontSize: 12, color: "#64748b", margin: "3px 0 0" }}>
                                {data.phone ? `${data.phone} · ` : ""}
                                {data.calls.length} call{data.calls.length === 1 ? "" : "s"}
                            </p>
                        </div>
                    </div>

                    <div style={{ padding: "16px 22px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
                        {calls.length === 0 && (
                            <div style={{ padding: "40px 0", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No recorded calls for this lead.</div>
                        )}
                        {calls.map(c => (
                            <CallCard key={c.id} call={c} open={openIds.has(c.id)} onToggle={() => toggle(c.id)} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
