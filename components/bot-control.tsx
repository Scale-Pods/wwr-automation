"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Check, ChevronDown, Loader2, Pause, Play, X } from "lucide-react";

type Action = "stop" | "resume";
type BotState = "stopped" | "active" | "unknown";

interface BotControlProps {
    /** The lead's crm_id — sent to the webhook on every click. */
    crmId?: string | null;
    /** Visual size. "sm" matches the compact toolbar buttons. */
    size?: "sm" | "md";
    className?: string;
}

const LS_PREFIX = "botControlState:";

function readState(crmId?: string | null): BotState {
    if (!crmId || typeof window === "undefined") return "unknown";
    try {
        const v = localStorage.getItem(LS_PREFIX + crmId);
        return v === "stopped" || v === "active" ? v : "unknown";
    } catch {
        return "unknown";
    }
}

function writeState(crmId: string, state: BotState) {
    try {
        localStorage.setItem(LS_PREFIX + crmId, state);
    } catch {
        /* ignore */
    }
}

/**
 * "Bot Control" button. Click to reveal "Stop now" / "Resume now"; each option
 * POSTs { crmId, action } to /api/bot-control, which forwards the lead's crm_id
 * and the action to the n8n webhook. After a successful call the button itself
 * turns red ("Bot Stopped") or green ("Bot Active") to reflect the new state,
 * remembered per-lead in localStorage.
 */
export function BotControl({ crmId, size = "sm", className }: BotControlProps) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState<Action | null>(null);
    const [state, setState] = useState<BotState>("unknown");
    const [error, setError] = useState<string | null>(null);
    const wrapRef = useRef<HTMLDivElement>(null);

    // hydrate remembered state whenever the lead changes
    useEffect(() => {
        setState(readState(crmId));
        setError(null);
    }, [crmId]);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, [open]);

    useEffect(() => {
        if (!error) return;
        const t = setTimeout(() => setError(null), 4000);
        return () => clearTimeout(t);
    }, [error]);

    const disabled = !crmId;

    async function trigger(action: Action, e: React.MouseEvent) {
        e.stopPropagation();
        if (!crmId || busy) return;
        setBusy(action);
        setError(null);
        try {
            const res = await fetch("/api/bot-control", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ crmId, action }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Request failed");
            } else {
                const next: BotState = action === "stop" ? "stopped" : "active";
                setState(next);
                writeState(crmId, next);
                setOpen(false);
            }
        } catch {
            setError("Network error");
        } finally {
            setBusy(null);
        }
    }

    const pad = size === "sm" ? "5px 11px" : "7px 13px";
    const fontSize = size === "sm" ? 12 : 13;
    const icon = size === "sm" ? 12 : 14;

    // button appearance driven by current state
    const appearance =
        state === "stopped"
            ? {
                  label: "Bot Stopped",
                  bg: "rgba(255,69,58,0.14)",
                  border: "rgba(255,69,58,0.35)",
                  color: "var(--red)",
                  Icon: Pause,
              }
            : state === "active"
              ? {
                    label: "Bot Active",
                    bg: "rgba(48,209,88,0.14)",
                    border: "rgba(48,209,88,0.35)",
                    color: "var(--green)",
                    Icon: Play,
                }
              : {
                    label: "Bot Control",
                    bg: "var(--fill-tertiary)",
                    border: "var(--glass-border)",
                    color: "var(--label-primary)",
                    Icon: Bot,
                };

    const HeadIcon = appearance.Icon;

    return (
        <div ref={wrapRef} style={{ position: "relative", display: "inline-block" }} className={className}>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    if (!disabled) setOpen((v) => !v);
                }}
                disabled={disabled}
                title={
                    disabled
                        ? "No CRM ID for this lead"
                        : state === "stopped"
                          ? "Bot is stopped for this lead — click to change"
                          : state === "active"
                            ? "Bot is active for this lead — click to change"
                            : "Stop or resume the bot conversation"
                }
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: pad,
                    borderRadius: 8,
                    fontSize,
                    fontWeight: 500,
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.5 : 1,
                    background: appearance.bg,
                    border: `1px solid ${appearance.border}`,
                    color: appearance.color,
                    whiteSpace: "nowrap",
                    transition: "background 0.15s ease, border-color 0.15s ease, color 0.15s ease",
                }}
            >
                {busy ? (
                    <Loader2 style={{ width: icon, height: icon }} className="animate-spin" />
                ) : (
                    <HeadIcon style={{ width: icon, height: icon }} />
                )}
                {appearance.label}
                <ChevronDown
                    style={{
                        width: icon,
                        height: icon,
                        transform: open ? "rotate(180deg)" : "none",
                        transition: "transform 0.15s ease",
                        opacity: 0.6,
                    }}
                />
            </button>

            {open && (
                <div
                    style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        right: 0,
                        zIndex: 100,
                        minWidth: 178,
                        background: "var(--bg-layer2)",
                        backdropFilter: "blur(30px) saturate(180%)",
                        border: "1px solid var(--glass-border)",
                        borderRadius: 10,
                        padding: 6,
                        boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                    }}
                >
                    <MenuItem
                        label="Stop now"
                        hint="Pause the bot for this lead"
                        icon={<Pause style={{ width: 13, height: 13 }} />}
                        color="var(--red)"
                        busy={busy === "stop"}
                        active={state === "stopped"}
                        onClick={(e) => trigger("stop", e)}
                    />
                    <MenuItem
                        label="Resume now"
                        hint="Let the bot reply again"
                        icon={<Play style={{ width: 13, height: 13 }} />}
                        color="var(--green)"
                        busy={busy === "resume"}
                        active={state === "active"}
                        onClick={(e) => trigger("resume", e)}
                    />
                </div>
            )}

            {error && (
                <div
                    style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        right: 0,
                        zIndex: 100,
                        maxWidth: 260,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "7px 10px",
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 500,
                        background: "rgba(255,69,58,0.12)",
                        border: "1px solid rgba(255,69,58,0.30)",
                        color: "var(--red)",
                    }}
                >
                    <X style={{ width: 12, height: 12, flexShrink: 0 }} />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}

function MenuItem({
    label,
    hint,
    icon,
    color,
    busy,
    active,
    onClick,
}: {
    label: string;
    hint: string;
    icon: React.ReactNode;
    color: string;
    busy: boolean;
    active: boolean;
    onClick: (e: React.MouseEvent) => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={busy || active}
            style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                width: "100%",
                padding: "8px 9px",
                borderRadius: 7,
                background: active ? "var(--fill-tertiary)" : "transparent",
                border: "none",
                cursor: busy || active ? "default" : "pointer",
                textAlign: "left",
                transition: "background 0.12s ease",
                opacity: active ? 0.85 : 1,
            }}
            className={busy || active ? "" : "hover:bg-[var(--fill-tertiary)]"}
        >
            <span style={{ color, marginTop: 1, flexShrink: 0 }}>
                {busy ? <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" /> : icon}
            </span>
            <span style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--label-primary)" }}>{label}</span>
                <span style={{ fontSize: 10.5, color: "var(--label-tertiary)" }}>
                    {active ? "Current state" : hint}
                </span>
            </span>
            {active && <Check style={{ width: 13, height: 13, color, flexShrink: 0, marginTop: 1 }} />}
        </button>
    );
}
