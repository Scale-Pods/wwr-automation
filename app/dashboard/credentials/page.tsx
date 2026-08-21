"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Mail, MessageCircle, Mic, ExternalLink, Copy, Eye, EyeOff, ShieldCheck, Wallet, Phone, BarChart3, Settings, Smartphone } from "lucide-react";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useData } from "@/context/DataContext";

export default function CredentialsPage() {
    const { calls, twilioBalance, loadingBalances } = useData();
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
                        <ReadOnlyField label="WhatsApp Account 1" value="Active Integration" />
                        <ReadOnlyField label="WhatsApp Account 2" value="Backup Line" />
                    </div>
                </CredentialSection>

                {/* Provisioned Numbers Section */}
                <CredentialSection
                    title="Provisioned Phone Numbers"
                    description="Active telephony lines for Voice and WhatsApp."
                    icon={Phone}
                    iconColor="text-cyan-600"
                    iconBg="bg-cyan-50/10"
                >
                    <div className="space-y-4 bg-[var(--fill-quaternary)] p-4 rounded-xl border border-[var(--glass-border)]">
                        <ReadOnlyField label="Twilio (US)" value="+1 (844) 639-0129" />
                        <ReadOnlyField label="Voice Agent ID" value="World_Wide_Real_Estate_Voice_Agent" />
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
                                Cost Analysis
                            </Button>
                            <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 gap-1.5" onClick={() => window.open('https://dashboard.vapi.ai/login', '_blank')}>
                                <Wallet className="h-3.5 w-3.5" />
                                Vapi Wallet
                            </Button>
                        </div>
                    </div>
                </CredentialSection>

                {/* Twilio Section */}
                <CredentialSection
                    title="Twilio Telephony"
                    description="Real-time balance and usage records for Twilio."
                    icon={Smartphone}
                    iconColor="text-rose-600"
                    iconBg="bg-rose-50/10"
                >
                    <div className="space-y-4">
                        <div className="bg-[var(--fill-quaternary)] rounded-lg p-4 border border-[var(--glass-border)] flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-[var(--fill-secondary)] rounded-md border border-[var(--glass-border)]">
                                    <Smartphone className="h-5 w-5 text-rose-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-[var(--label-primary)]">Twilio Account</p>
                                    <p className="text-xs text-[var(--label-tertiary)] font-mono">{twilioBalance?.account_sid ? `${twilioBalance.account_sid.slice(0, 8)}...` : '---'}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-black text-rose-600">
                                    {twilioBalance?.balance !== undefined ? `$${twilioBalance.balance.toFixed(2)}` : '---'}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-center">
                            <div className="bg-[var(--fill-secondary)] p-3 rounded-lg border border-[var(--glass-border)] shadow-sm">
                                <p className="text-[10px] font-bold text-[var(--label-tertiary)] uppercase tracking-wider">Total Recharge</p>
                                <p className="text-sm font-bold text-[var(--label-primary)] mt-0.5">
                                    {twilioBalance?.total_recharge !== undefined ? `$${twilioBalance.total_recharge.toFixed(2)}` : '---'}
                                </p>
                            </div>
                            <div className="bg-[var(--fill-secondary)] p-3 rounded-lg border border-[var(--glass-border)] shadow-sm">
                                <p className="text-[10px] font-bold text-[var(--label-tertiary)] uppercase tracking-wider">Used</p>
                                <p className="text-sm font-bold text-[var(--label-secondary)] mt-0.5">
                                    {twilioBalance?.used !== undefined ? `$${twilioBalance.used.toFixed(2)}` : '---'}
                                </p>
                            </div>
                        </div>

                        <div className="pt-2">
                            <Button size="sm" className="w-full bg-rose-600 hover:bg-rose-700 text-white text-xs h-9 gap-1.5" onClick={() => window.open('https://console.twilio.com', '_blank')}>
                                <ExternalLink className="h-3.5 w-3.5" />
                                Twilio Console
                            </Button>
                        </div>
                    </div>
                </CredentialSection>
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

function ReadOnlyField({ label, value, isPassword }: { label: string, value: string, isPassword?: boolean }) {
    const [show, setShow] = useState(false);
    const displayValue = isPassword && !show ? "••••••••••••••••••••••••" : value;

    return (
        <div className="space-y-1">
            <Label className="text-[10px] font-bold text-[var(--label-tertiary)] uppercase tracking-wider">{label}</Label>
            <div className="relative group">
                <div className="flex items-center w-full rounded-md border border-[var(--glass-border)] bg-[var(--fill-tertiary)] px-3 py-1.5 text-xs text-[var(--label-primary)] shadow-sm">
                    <span className="flex-1 truncate font-sans">
                        {displayValue}
                    </span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 ml-2 text-[var(--label-secondary)] hover:text-[var(--label-primary)] opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => navigator.clipboard.writeText(value)}
                    >
                        <Copy className="h-3 w-3" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
