"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Check } from "lucide-react";

type Channel = "whatsapp" | "email" | "voice_call" | "";

const CHANNEL_OPTIONS: { value: Channel; label: string }[] = [
    { value: "", label: "— Blank —" },
    { value: "whatsapp", label: "WhatsApp" },
    { value: "email", label: "Email" },
    { value: "voice_call", label: "Voice Call" },
];

const SEQUENCE_OPTIONS = [
    { value: "30_day", label: "30 Day Sequence" },
];

interface OutreachSequenceModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function OutreachSequenceModal({ isOpen, onClose }: OutreachSequenceModalProps) {
    const [sequenceType, setSequenceType] = useState<string>("30_day");
    const [channels, setChannels] = useState<Channel[]>(Array(30).fill(""));
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<"success" | "error" | null>(null);
    const [errorMessage, setErrorMessage] = useState("");

    const setDayChannel = (dayIndex: number, value: Channel) => {
        setChannels((prev) => {
            const next = [...prev];
            next[dayIndex] = value;
            return next;
        });
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        setResult(null);
        setErrorMessage("");

        const payload = {
            sequence_type: sequenceType,
            days: channels.map((channel, i) => ({
                day: i + 1,
                channel: channel || null,
            })),
        };

        try {
            const res = await fetch("/api/outreach-generator", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `Request failed (${res.status})`);
            }

            setResult("success");
        } catch (err: any) {
            setResult("error");
            setErrorMessage(err.message || "Something went wrong. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        if (submitting) return;
        onClose();
        // Reset after the close animation finishes.
        setTimeout(() => {
            setResult(null);
            setErrorMessage("");
        }, 200);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-[520px] max-h-[85vh] flex flex-col p-0 gap-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-[var(--hairline)]">
                    <DialogTitle style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.022em", color: "var(--label-primary)" }}>
                        Outreach Sequence Builder
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5" style={{ minHeight: 0 }}>
                    <div className="flex flex-col gap-2 mb-5">
                        <label className="text-[11px] font-semibold uppercase tracking-widest text-[var(--label-tertiary)]">
                            Sequence Type
                        </label>
                        <Select value={sequenceType} onValueChange={setSequenceType}>
                            <SelectTrigger className="border-none" style={{ background: "var(--fill-tertiary)", border: "1px solid var(--glass-border)", color: "var(--label-primary)" }}>
                                <SelectValue placeholder="Select a sequence" />
                            </SelectTrigger>
                            <SelectContent className="apple-dialog">
                                {SEQUENCE_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {sequenceType === "30_day" && (
                        <div className="flex flex-col gap-2">
                            <label className="text-[11px] font-semibold uppercase tracking-widest text-[var(--label-tertiary)] mb-1">
                                Channel per Day
                            </label>
                            {channels.map((channel, i) => (
                                <div
                                    key={i}
                                    className="flex items-center gap-3 py-1.5"
                                >
                                    <span
                                        className="text-[13px] font-medium text-[var(--label-secondary)] shrink-0"
                                        style={{ width: 56 }}
                                    >
                                        Day {i + 1}
                                    </span>
                                    <Select
                                        value={channel === "" ? "__blank__" : channel}
                                        onValueChange={(v) => setDayChannel(i, v === "__blank__" ? "" : (v as Channel))}
                                    >
                                        <SelectTrigger className="h-8 text-[13px] border-none" style={{ background: "var(--fill-tertiary)", border: "1px solid var(--glass-border)", color: "var(--label-primary)" }}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="apple-dialog">
                                            {CHANNEL_OPTIONS.map((opt) => (
                                                <SelectItem key={opt.value || "__blank__"} value={opt.value || "__blank__"}>
                                                    {opt.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-[var(--hairline)] flex items-center justify-between gap-3" style={{ background: "var(--bg-layer1)" }}>
                    <div className="text-[13px]" style={{ minHeight: 18 }}>
                        {result === "success" && (
                            <span className="flex items-center gap-1.5 text-emerald-400">
                                <Check size={14} /> Sequence sent successfully
                            </span>
                        )}
                        {result === "error" && (
                            <span className="text-red-400">{errorMessage}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleClose}
                            disabled={submitting}
                            className="px-4 py-2 rounded-lg text-[13px] font-medium text-[var(--label-secondary)] hover:bg-[var(--fill-tertiary)] transition-colors disabled:opacity-50"
                        >
                            Close
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold text-white transition-colors disabled:opacity-60"
                            style={{ background: "var(--blue, #0A84FF)" }}
                        >
                            {submitting && <Loader2 size={14} className="animate-spin" />}
                            {submitting ? "Sending…" : "Send Sequence"}
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
