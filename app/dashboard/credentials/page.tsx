"use client";

import { Button } from "@/components/ui/button";
import { MessageCircle, Mic, Copy, Wallet, Phone, BarChart3, Check } from "lucide-react";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useData } from "@/context/DataContext";

const VAPI_ACCOUNTS = [
    {
        label: "WWR Commercial",
        vapiLabel: "wwr-commercial",
        email: "rizwan@wwrqatar.com",
        endpointUrl: "sip:wwrxscalepods_support_2026@sip.vapi.ai",
        assistantSelectorUrl: "https://vapi-maqsam-bridge-wwr-2-588249993033.europe-west3.run.app/assistant-selector",
        assistantId: "ec46b36b-6eba-45d0-bfdc-5eb1c39f75da",
        phone: "+97440197787",
    },
    {
        label: "WWR Residential",
        vapiLabel: "wwr residential",
        email: "sales@wwrqatar.com",
        endpointUrl: "sip:wwrxscalepods_support_2026_second@sip.vapi.ai",
        assistantSelectorUrl: "https://vapi-maqsam-bridge-wwr-1-588249993033.europe-west3.run.app/assistant-selector",
        assistantId: "8bb8b584-1307-4e97-996c-360cfc40c892",
        phone: "+97440196942",
    },
    {
        label: "WWR Business",
        vapiLabel: "wwr business",
        email: "info@wwrqatar.com",
        endpointUrl: "sip:wwrxscalepods_support_2026_third@sip.vapi.ai",
        assistantSelectorUrl: "https://vapi-maqsam-bridge-wwr-3-588249993033.europe-west3.run.app/assistant-selector",
        assistantId: "79a32791-27b0-46d2-91ed-bc0fecc46eae",
        phone: "+97440197754",
    },
];

type VapiAccount = typeof VAPI_ACCOUNTS[number];

const WHATSAPP_NUMBER = "+97430020275";

export default function CredentialsPage() {
    const { calls } = useData();
    const router = useRouter();

    const vapiAgentUsed = React.useMemo(() => {
        if (!calls || !Array.isArray(calls)) return 0;
        return calls.filter((c: any) => c.source === 'vapi').reduce((acc: number, call: any) => acc + (call.breakdown?.agent || 0), 0);
    }, [calls]);

    return (
        <div className="space-y-4 pb-6 max-w-6xl mx-auto">
            <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: 'var(--ls-heading)', color: 'var(--label-primary)' }}>Credentials Management</h1>
                <p style={{ fontSize: 13, color: 'var(--label-secondary)', marginTop: 2 }}>View your active integrations and manageable accounts.</p>
            </div>

            {/* Top cards: compact, equal height, stack on small screens */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                <CredentialSection
                    title="WhatsApp Business API"
                    description="Meta Business API credentials for WhatsApp CRM."
                    icon={MessageCircle}
                    tileClass="bg-emerald-500/10 text-emerald-400"
                >
                    <Field label="WhatsApp Number" value={WHATSAPP_NUMBER} />
                </CredentialSection>

                <CredentialSection
                    title="Voice Agent (Vapi)"
                    description="AI voice configuration and lifetime cost."
                    icon={Mic}
                    tileClass="bg-blue-500/10 text-blue-400"
                >
                    <div className="flex flex-col gap-3">
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[13px] font-semibold text-[var(--label-primary)]">Vapi Integration</p>
                                <p className="text-[11px] text-slate-400">Lifetime Consumption</p>
                            </div>
                            <p className="text-xl font-semibold tabular-nums text-blue-400 shrink-0">${vapiAgentUsed.toFixed(2)}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                variant="outline"
                                className="h-8 w-full px-3 gap-1.5 text-xs rounded-lg border-white/10 text-[var(--label-primary)] hover:bg-white/[0.06]"
                                onClick={() => router.push('/dashboard/voice/logs')}
                            >
                                <BarChart3 className="h-3.5 w-3.5" /> Call Logs
                            </Button>
                            <Button
                                className="h-8 w-full px-3 gap-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={() => window.open('https://dashboard.vapi.ai/login', '_blank')}
                            >
                                <Wallet className="h-3.5 w-3.5" /> Vapi Wallet
                            </Button>
                        </div>
                    </div>
                </CredentialSection>
            </div>

            {/* Voice agent accounts: one card per account, side by side — everything visible, nothing scrolls */}
            <CredentialSection
                title="Voice Agent Accounts"
                description="Vapi/Maqsam SIP endpoints per board, with their assistant IDs and phone lines."
                icon={Phone}
                tileClass="bg-sky-500/10 text-sky-400"
            >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    {VAPI_ACCOUNTS.map(acc => <AccountCard key={acc.assistantId} account={acc} />)}
                </div>
            </CredentialSection>
        </div>
    );
}

function AccountCard({ account }: { account: VapiAccount }) {
    return (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2.5 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-semibold text-[var(--label-primary)]">{account.label}</span>
                <span className="text-[11px] font-mono text-slate-500">{account.vapiLabel}</span>
            </div>
            <Field label="Vapi Email" value={account.email} mono={false} compact />
            <Field label="Endpoint URL" value={account.endpointUrl} compact />
            <Field label="Assistant ID" value={account.assistantId} compact />
            <Field label="Phone" value={account.phone} compact />
            <Field label="Assistant Selector" value={account.assistantSelectorUrl} compact />
        </div>
    );
}

function Field({ label, value, mono = true, compact }: { label: string; value: string; mono?: boolean; compact?: boolean }) {
    return (
        <div className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{label}</span>
            <div className={`rounded-lg border border-white/10 bg-white/[0.03] ${compact ? "px-2.5 py-1.5" : "px-3 py-2"}`}>
                <CopyCell value={value} mono={mono} />
            </div>
        </div>
    );
}

/** A single-line value (ellipsis + full value on hover) with a fixed copy button on the right. */
function CopyCell({ value, mono = true }: { value: string; mono?: boolean }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className="grid items-center gap-2 w-full" style={{ gridTemplateColumns: "minmax(0, 1fr) 24px" }}>
            <span
                className={`block overflow-hidden text-ellipsis whitespace-nowrap text-xs font-normal text-slate-300 ${mono ? "font-mono" : ""}`}
                title={value}
            >
                {value}
            </span>
            <button
                type="button"
                onClick={handleCopy}
                aria-label={copied ? `Copied ${value}` : `Copy ${value}`}
                title={copied ? "Copied" : "Copy"}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
            >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
        </div>
    );
}

function CredentialSection({ title, description, icon: Icon, tileClass, children }: {
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    tileClass: string;
    children: React.ReactNode;
}) {
    return (
        <section className="liquid-card h-full flex flex-col overflow-hidden rounded-2xl border border-white/10" style={{ padding: 0 }}>
            <header className="flex items-center gap-2.5 px-4 py-2.5 border-b border-white/10 bg-white/[0.03]">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tileClass}`}>
                    <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                    <h2 className="text-[13px] font-semibold text-[var(--label-primary)]">{title}</h2>
                    <p className="text-[11px] text-slate-400">{description}</p>
                </div>
            </header>
            <div className="flex-1 p-4">
                {children}
            </div>
        </section>
    );
}
