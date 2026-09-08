"use client";

import { useEffect } from "react";
import Image from "next/image";
import { ArrowRight, Mail, MessageCircle, Mic, Sparkles, Users, TrendingUp, Building2 } from "lucide-react";
import { AuthForms } from "@/components/auth/auth-forms";

export default function LandingPage() {
    // A password-recovery link that lands here (Supabase falls back to Site URL
    // when the link's redirect target isn't allow-listed, or from a stale email)
    // still carries the token — in the URL hash or as a ?code= query param.
    // Forward it to the real reset page instead of showing the login form.
    useEffect(() => {
        const { hash, search } = window.location;
        const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
        const queryParams = new URLSearchParams(search);

        const isRecovery =
            hashParams.get("type") === "recovery" ||
            queryParams.get("type") === "recovery";
        const hasHashToken = !!hashParams.get("access_token");
        const hasCode = !!queryParams.get("code");

        if ((isRecovery && (hasHashToken || hasCode)) || (hasHashToken && hashParams.get("refresh_token"))) {
            window.location.replace(`/reset-password${search}${hash}`);
        }
    }, []);

    return (
        <div
            className="min-h-screen overflow-hidden"
            style={{
                backgroundColor: '#111111',
            }}
        >
            {/* ── Header ── */}
            <header
                className="fixed top-0 w-full z-50"
                style={{
                    background: 'rgba(10,10,15,0.72)',
                    backdropFilter: 'blur(48px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(48px) saturate(180%)',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}
            >
                <div className="max-w-6xl mx-auto px-6 h-[60px] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative flex items-center h-[44px] w-[180px]">
                            <Image src="/logo.png" alt="World Wide Real Estate" fill className="object-contain object-left" priority />
                        </div>
                        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.12)' }} />
                        <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.40)', letterSpacing: '-0.01em', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            Powered by{' '}
                            <span style={{ fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em', fontSize: 13 }}>ScalePods</span>
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => document.getElementById('login-form')?.scrollIntoView({ behavior: 'smooth' })}
                            style={{
                                padding: '8px 16px',
                                borderRadius: 10,
                                fontSize: 14,
                                fontWeight: 500,
                                color: 'rgba(255,255,255,0.60)',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                letterSpacing: '-0.01em',
                                transition: 'color 130ms ease',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.90)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.60)')}
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => document.getElementById('login-form')?.scrollIntoView({ behavior: 'smooth' })}
                            style={{
                                padding: '9px 20px',
                                borderRadius: 10,
                                fontSize: 14,
                                fontWeight: 600,
                                color: '#ffffff',
                                background: 'var(--blue, #0A84FF)',
                                border: 'none',
                                cursor: 'pointer',
                                letterSpacing: '-0.01em',
                                transition: 'opacity 150ms ease, transform 100ms ease',
                                boxShadow: '0 2px 8px rgba(10,132,255,0.35)',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
                            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                            onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
                            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                        >
                            Get Started
                        </button>
                    </div>
                </div>
            </header>

            {/* ── Hero ── */}
            <section className="relative min-h-screen flex flex-col justify-center px-6 pt-16">
                <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
                    {/* Left: Content */}
                    <div className="flex flex-col justify-center text-center lg:text-left">
                        {/* Pill */}
                        <div className="mb-6">
                            <div
                                className="inline-flex items-center gap-1.5"
                                style={{
                                    padding: '6px 16px',
                                    borderRadius: 8,
                                    background: 'rgba(139, 92, 246, 0.15)',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: '#A78BFA',
                                }}
                            >
                                <Sparkles size={14} /> AI-Powered Growth Automation Platform
                            </div>
                        </div>

                        {/* Headline */}
                        <h1
                            className="text-4xl sm:text-5xl xl:text-6xl font-bold tracking-tight mb-6 leading-[1.08] text-white"
                        >
                            Automate Smarter with{" "}
                            <span className="bg-gradient-to-r from-purple-400 via-blue-500 to-indigo-400 bg-clip-text text-transparent">
                                World Wide Real Estate
                            </span>{" "}
                            Growth OS
                        </h1>

                        {/* Sub */}
                        <p
                            className="text-lg max-w-xl mb-10 leading-relaxed text-gray-400 mx-auto lg:mx-0"
                        >
                            A complete suite of intelligent tools to capture leads and automate follow-ups. Manage every channel from one powerful dashboard.
                        </p>

                        {/* Stats Row */}
                        <div className="flex flex-col sm:flex-row justify-center lg:justify-start gap-6 mb-10">
                            {[
                                { icon: <Users size={20} color="#A78BFA" />, value: "10K+", label: "Leads Captured" },
                                { icon: <TrendingUp size={20} color="#A78BFA" />, value: "85%", label: "Faster Growth" },
                                { icon: <Building2 size={20} color="#A78BFA" />, value: "500+", label: "Campaigns Sent" },
                            ].map((s, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                                        {s.icon}
                                    </div>
                                    <div className="text-left">
                                        <p className="text-[26px] font-light tracking-tight leading-none text-white">{s.value}</p>
                                        <p className="text-xs text-gray-400 mt-1">{s.label}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* CTA button */}
                        <div>
                            <button
                                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-colors"
                            >
                                See Features <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Right: Login Form */}
                    <div id="login-form" className="w-full lg:max-w-[480px] flex-shrink-0 mx-auto">
                        <div style={{
                            background: '#1C1C1E',
                            borderRadius: 24,
                            padding: '40px 32px',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
                            border: '1px solid rgba(255,255,255,0.05)',
                        }}>
                            {/* Logo */}
                            <div className="flex flex-col items-center pb-6 pt-2 text-center">
                                <div className="relative w-[220px] h-[100px]">
                                    <Image src="/logo.png" alt="World Wide Real Estate" fill className="object-contain" priority />
                                </div>
                            </div>
                            <AuthForms defaultMode="login" />
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Feature Cards ── */}
            <section id="features" className="py-24 px-6">
                <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-5">
                    {[
                        {
                            icon: <Mail size={22} />,
                            color: '#0A84FF',
                            title: 'Email Marketing',
                            description: 'Send bulk campaigns, track opens and clicks, and verify bounce rates. Integrate with Gmail for high-volume outreach with precision analytics.',
                        },
                        {
                            icon: <MessageCircle size={22} />,
                            color: '#30D158',
                            title: 'WhatsApp CRM',
                            description: 'Engage leads instantly with broadcast messages and organised chat lists. Track delivery, manage customer details, and automate replies 24/7.',
                        },
                        {
                            icon: <Mic size={22} />,
                            color: '#FF9F0A',
                            title: 'AI Voice Agents',
                            description: 'Deploy human-like AI assistants for inbound support and outbound sales. Auto-schedule meetings, verify leads, and analyse calls with sentiment.',
                        },
                    ].map((card, i) => (
                        <div
                            key={i}
                            style={{
                                background: 'rgba(255,255,255,0.04)',
                                backdropFilter: 'blur(40px) saturate(180%)',
                                WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                                borderRadius: 24,
                                padding: '28px 28px 32px',
                                outline: '1px solid rgba(255,255,255,0.07)',
                                outlineOffset: -1,
                                boxShadow: '0 2px 4px rgba(0,0,0,0.20), 0 16px 40px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.06)',
                                position: 'relative',
                                overflow: 'hidden',
                                transition: 'transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 220ms ease',
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.transform = 'translateY(-3px) scale(1.003)';
                                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.26), 0 24px 56px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.10)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.20), 0 16px 40px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.06)';
                            }}
                        >
                            {/* Ambient glow per card */}
                            <div
                                style={{
                                    position: 'absolute', top: -30, right: -30,
                                    width: 100, height: 100, borderRadius: '50%',
                                    background: card.color,
                                    opacity: 0.10,
                                    filter: 'blur(32px)',
                                    pointerEvents: 'none',
                                }}
                            />

                            <div
                                style={{
                                    width: 44, height: 44, borderRadius: 12,
                                    background: `${card.color}18`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: card.color,
                                    marginBottom: 20,
                                }}
                            >
                                {card.icon}
                            </div>

                            <h3
                                style={{
                                    fontSize: 18, fontWeight: 600,
                                    color: 'rgba(255,255,255,0.92)',
                                    letterSpacing: '-0.022em',
                                    marginBottom: 10,
                                }}
                            >
                                {card.title}
                            </h3>
                            <p
                                style={{
                                    fontSize: 14, lineHeight: 1.6,
                                    color: 'rgba(255,255,255,0.44)',
                                    letterSpacing: '-0.011em',
                                    fontWeight: 400,
                                }}
                            >
                                {card.description}
                            </p>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
