"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MessageCircle, Mic, Copy, Wallet, Phone, BarChart3, Mail, Check } from "lucide-react";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useData } from "@/context/DataContext";

const VAPI_ACCOUNTS = [
    {
        label: "WWR Commercial",
        email: "rizwan@wwrqatar.com",
        endpointUrl: "sip:wwrxscalepods_support_2026@sip.vapi.ai",
        assistantSelectorUrl: "https://vapi-maqsam-bridge-wwr-2-495116172944.europe-west3.run.app/assistant-selector",
        assistantId: "ec46b36b-6eba-45d0-bfdc-5eb1c39f75da",
        phone: "+97440197787",
    },
    {
        label: "WWR Residential",
        email: "sales@wwrqatar.com",
        endpointUrl: "sip:wwrxscalepods_support_2026_second@sip.vapi.ai",
        assistantSelectorUrl: "https://vapi-maqsam-bridge-wwr-1-495116172944.europe-west3.run.app/assistant-selector",
        assistantId: "8bb8b584-1307-4e97-996c-360cfc40c892",
        phone: "+97440196942",
    },
    {
        label: "WWR Business",
        email: "info@wwrqatar.com",
        endpointUrl: "sip:wwrxscalepods_support_2026_third@sip.vapi.ai",
        assistantSelectorUrl: "https://vapi-maqsam-bridge-wwr-3-495116172944.europe-west1.run.app/assistant-selector",
        assistantId: "79a32791-27b0-46d2-91ed-bc0fecc46eae",
        phone: "+97440197754",
    },
];

const WHATSAPP_NUMBER = "+97430020275";

export default function CredentialsPage() {
    const { calls } = useData();
    const router = useRouter();

    const vapiAgentUsed = React.useMemo(() => {
        if (!calls || !Array.isArray(calls)) return 0;
        return calls.filter((c: any) => c.source === 'vapi').reduce((acc: number, call: any) => acc + (call.breakdown?.agent || 0), 0);
    }, [calls]);

    return (
        <div className="space-y-6 pb-10 max-w-5xl mx-auto">
            <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: 'var(--ls-heading)', color: 'var(--label-primary)' }}>Credentials Management</h1>
                <p style={{ fontSize: 13, color: 'var(--label-secondary)', marginTop: 2 }}>View your active integrations and manageable accounts.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* WhatsApp Section */}
                <CredentialSection
                    title="WhatsApp Business API"
                    description="Meta Business API credentials for WhatsApp CRM."
                    icon={MessageCircle}
                    iconColor="text-emerald-600"
                    iconBg="bg-emerald-50/10"
                >
                    <div className="grid gap-4">
                        <ReadOnlyField label="WhatsApp Number" value={WHATSAPP_NUMBER} />
                    </div>
                </CredentialSection>

                {/* Voice Section */}
                <CredentialSection
                    title="Voice Agent (Vapi)"
                    description="AI Voice configuration and lifetime cost."
                    icon={Mic}
                    iconColor="text-blue-600"
                    iconBg="bg-blue-50/10"
                >
                    <div className="space-y-4">
                        <div className="bg-[var(--fill-quaternary)] rounded-lg p-4 border border-[var(--glass-border)] flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-[var(--fill-secondary)] rounded-md border border-[var(--glass-border)]">
                                    <Mic className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-[var(--label-primary)]">Vapi Integration</p>
                                    <p className="text-xs text-[var(--label-tertiary)]">Lifetime Consumption</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-black text-blue-600">
                                    ${vapiAgentUsed.toFixed(2)}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                            <Button variant="outline" size="sm" className="flex-1 border-[var(--glass-border)] text-[var(--label-primary)] hover:bg-[var(--fill-secondary)] text-xs h-9 gap-1.5" onClick={() => router.push('/dashboard/voice/logs')}>
                                <BarChart3 className="h-3.5 w-3.5" />
                                Call Logs
                            </Button>
                            <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 gap-1.5" onClick={() => window.open('https://dashboard.vapi.ai/login', '_blank')}>
                                <Wallet className="h-3.5 w-3.5" />
                                Vapi Wallet
                            </Button>
                        </div>
                    </div>
                </CredentialSection>

                {/* Voice Agent Accounts Section — spans full width, 3 accounts */}
                <CredentialSection
                    title="Voice Agent Accounts"
                    description="Vapi/Maqsam SIP endpoints per board, with their assistant IDs and phone lines."
                    icon={Phone}
                    iconColor="text-cyan-600"
                    iconBg="bg-cyan-50/10"
                    className="md:col-span-2"
                >
                    <div className="grid gap-4 md:grid-cols-3">
                        {VAPI_ACCOUNTS.map(acc => (
                            <VapiAccountCard key={acc.assistantId} account={acc} />
                        ))}
                    </div>
                </CredentialSection>

            </div>
        </div>
    );
}

function VapiAccountCard({ account }: { account: typeof VAPI_ACCOUNTS[number] }) {
    return (
        <div className="bg-[var(--fill-quaternary)] rounded-xl border border-[var(--glass-border)] p-4 space-y-3">
            <div>
                <p className="text-sm font-bold text-[var(--label-primary)]">{account.label}</p>
                <p className="text-[11px] text-[var(--label-tertiary)] mt-0.5 flex items-center gap-1.5">
                    <Mail className="h-3 w-3" /> {account.email}
                </p>
            </div>
            <div className="space-y-3">
                <ReadOnlyField label="Endpoint URL" value={account.endpointUrl} mono small />
                <ReadOnlyField label="Assistant Selector" value={account.assistantSelectorUrl} mono small />
                <ReadOnlyField label="Assistant ID" value={account.assistantId} mono small />
                <ReadOnlyField label="Phone Number" value={account.phone} mono small />
            </div>
        </div>
    );
}

function CredentialSection({ title, description, icon: Icon, iconColor, iconBg, children, className }: any) {
    return (
        <div className={`liquid-card overflow-hidden ${className || ""}`} style={{ padding: 0 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--separator)', background: 'var(--fill-quaternary)' }}>
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg ${iconBg} ${iconColor}`}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--label-primary)' }}>{title}</h2>
                        <p style={{ fontSize: 11, color: 'var(--label-secondary)', marginTop: 1 }}>{description}</p>
                    </div>
                </div>
            </div>
            <div style={{ padding: 20 }}>
                {children}
            </div>
        </div>
    );
}

function ReadOnlyField({ label, value, isPassword, mono, small }: { label: string, value: string, isPassword?: boolean, mono?: boolean, small?: boolean }) {
    const [show, setShow] = useState(false);
    const [copied, setCopied] = useState(false);
    const displayValue = isPassword && !show ? "••••••••••••••••••••••••" : value;

    const handleCopy = () => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className="space-y-1">
            <Label className="text-[10px] font-bold text-[var(--label-tertiary)] uppercase tracking-wider">{label}</Label>
            <div className="relative group">
                <div className={`flex items-start gap-2 w-full rounded-md border border-[var(--glass-border)] bg-[var(--fill-tertiary)] px-3 text-[var(--label-primary)] shadow-sm ${small ? "py-1.5 text-[11px]" : "py-1.5 text-xs"}`}>
                    <span className={`flex-1 min-w-0 break-all ${mono ? "font-mono" : "font-sans"}`}>
                        {displayValue}
                    </span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 flex-shrink-0 mt-0.5 text-[var(--label-secondary)] hover:text-[var(--label-primary)] opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={handleCopy}
                    >
                        {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    </Button>
                </div>
            </div>
        </div>
    );
}
