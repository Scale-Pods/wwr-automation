'use client';

import { useState, useEffect, useActionState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@supabase/supabase-js';
import { Lock, ArrowRight, Loader2, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react';
import { resetPassword } from '@/app/actions/auth';

export default function ResetPasswordPage() {
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [hashError, setHashError] = useState<string | null>(null);
    const [checking, setChecking] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const router = useRouter();

    const [state, action, isPending] = useActionState(resetPassword, null as any);

    useEffect(() => {
        let cancelled = false;
        const invalid = () => { if (!cancelled) { setHashError('Invalid or expired reset link. Please request a new one.'); setChecking(false); } };

        (async () => {
            // Format A: token in the URL hash (#access_token=…&type=recovery) —
            // Supabase's default {{ .ConfirmationURL }} template after /auth/v1/verify.
            const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
            const hashToken = hashParams.get('access_token');
            const hashType = hashParams.get('type');
            if (hashToken && (hashType === 'recovery' || !hashType)) {
                if (!cancelled) { setAccessToken(hashToken); setChecking(false); }
                window.history.replaceState(null, '', window.location.pathname);
                return;
            }

            // Format B: PKCE ?code=… in the query string — needs a session exchange.
            const url = new URL(window.location.href);
            const code = url.searchParams.get('code');
            if (code) {
                try {
                    const supabase = createClient(
                        process.env.NEXT_PUBLIC_SUPABASE_URL!,
                        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                    );
                    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
                    if (error || !data.session?.access_token) return invalid();
                    if (!cancelled) { setAccessToken(data.session.access_token); setChecking(false); }
                    window.history.replaceState(null, '', window.location.pathname);
                    return;
                } catch {
                    return invalid();
                }
            }

            invalid();
        })();

        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (state?.success) {
            const t = setTimeout(() => router.push('/'), 3000);
            return () => clearTimeout(t);
        }
    }, [state, router]);

    return (
        <div
            className="min-h-screen flex items-center justify-center p-6"
            style={{ background: '#131316' }}
        >
            {/* ambient glow */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full"
                    style={{ background: 'radial-gradient(ellipse, rgba(10,132,255,0.12) 0%, transparent 70%)' }} />
                <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full"
                    style={{ background: 'radial-gradient(ellipse, rgba(94,92,230,0.08) 0%, transparent 70%)' }} />
            </div>

            <div className="relative w-full max-w-[420px]">
                {/* Card */}
                <div
                    className="relative rounded-3xl overflow-hidden"
                    style={{
                        background: 'rgba(28,28,32,0.85)',
                        backdropFilter: 'blur(40px)',
                        WebkitBackdropFilter: 'blur(40px)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.3), 0 16px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
                    }}
                >
                    {/* top highlight line */}
                    <div className="absolute top-0 inset-x-0 h-px"
                        style={{ background: 'linear-gradient(90deg, transparent, rgba(10,132,255,0.5), transparent)' }} />

                    <div className="p-8 pt-9 space-y-7">
                        {/* Logo */}
                        <div className="flex justify-center">
                            <div className="relative" style={{ width: 190, height: 44 }}>
                                <Image
                                    src="/logo.png"
                                    alt="World Wide Real Estate"
                                    fill
                                    sizes="190px"
                                    className="object-contain"
                                    priority
                                />
                            </div>
                        </div>

                        {/* ── Verifying link ── */}
                        {checking && !hashError && (
                            <div className="flex flex-col items-center gap-3 py-10">
                                <Loader2 className="h-7 w-7 animate-spin" style={{ color: 'rgba(235,235,245,0.45)' }} />
                                <p className="text-sm" style={{ color: 'rgba(235,235,245,0.55)' }}>Verifying your reset link&hellip;</p>
                            </div>
                        )}

                        {/* ── Invalid link state ── */}
                        {!checking && hashError && (
                            <div className="space-y-6 text-center py-2">
                                <div className="flex justify-center">
                                    <div className="h-16 w-16 rounded-full flex items-center justify-center"
                                        style={{ background: 'rgba(255,69,58,0.12)', border: '1px solid rgba(255,69,58,0.2)' }}>
                                        <XCircle className="h-8 w-8" style={{ color: '#FF453A' }} />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <h1 className="text-[22px] font-semibold leading-tight" style={{ color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.022em' }}>
                                        Link Invalid
                                    </h1>
                                    <p className="text-sm" style={{ color: 'rgba(235,235,245,0.55)' }}>{hashError}</p>
                                </div>
                                <button
                                    onClick={() => router.push('/')}
                                    className="w-full h-11 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm transition-opacity hover:opacity-90"
                                    style={{ background: '#0A84FF', color: '#fff' }}
                                >
                                    Back to Login
                                    <ArrowRight className="h-4 w-4" />
                                </button>
                            </div>
                        )}

                        {/* ── Success state ── */}
                        {!checking && !hashError && state?.success && (
                            <div className="space-y-6 text-center py-2">
                                <div className="flex justify-center">
                                    <div className="h-16 w-16 rounded-full flex items-center justify-center"
                                        style={{ background: 'rgba(48,209,88,0.12)', border: '1px solid rgba(48,209,88,0.2)' }}>
                                        <CheckCircle2 className="h-8 w-8" style={{ color: '#30D158' }} />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <h1 className="text-[22px] font-semibold leading-tight" style={{ color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.022em' }}>
                                        Password Updated
                                    </h1>
                                    <p className="text-sm" style={{ color: 'rgba(235,235,245,0.55)' }}>{state.message}</p>
                                </div>
                                <div className="flex items-center justify-center gap-2 text-xs" style={{ color: 'rgba(235,235,245,0.35)' }}>
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Redirecting to login&hellip;
                                </div>
                            </div>
                        )}

                        {/* ── Form state ── */}
                        {!checking && !hashError && !state?.success && (
                            <div className="space-y-6">
                                <div className="space-y-1.5 text-center">
                                    <h1 className="text-[22px] font-semibold leading-tight" style={{ color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.02em' }}>
                                        Set New Password
                                    </h1>
                                    <p className="text-[13px]" style={{ color: 'rgba(235,235,245,0.50)' }}>
                                        Choose a strong password for your account
                                    </p>
                                </div>

                                {state?.error && (
                                    <div
                                        className="px-4 py-3 rounded-xl text-xs font-semibold text-center"
                                        style={{
                                            background: 'rgba(255,69,58,0.10)',
                                            border: '1px solid rgba(255,69,58,0.20)',
                                            color: '#FF453A',
                                        }}
                                    >
                                        {state.error}
                                    </div>
                                )}

                                <form action={action} className="space-y-4">
                                    <input type="hidden" name="accessToken" value={accessToken ?? ''} />

                                    {/* New Password */}
                                    <div className="space-y-2">
                                        <label
                                            htmlFor="password"
                                            className="block text-xs font-semibold uppercase"
                                            style={{ color: 'rgba(235,235,245,0.50)', letterSpacing: '0.06em' }}
                                        >
                                            New Password
                                        </label>
                                        <div className="relative">
                                            <Lock
                                                className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                                                style={{ color: 'rgba(235,235,245,0.30)' }}
                                            />
                                            <input
                                                id="password"
                                                name="password"
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder="••••••••"
                                                required
                                                minLength={8}
                                                autoFocus
                                                className="w-full h-12 pl-10 pr-11 rounded-xl text-sm outline-none transition-all"
                                                style={{
                                                    background: 'rgba(255,255,255,0.06)',
                                                    border: '1px solid rgba(255,255,255,0.10)',
                                                    color: 'rgba(255,255,255,0.90)',
                                                    caretColor: '#0A84FF',
                                                }}
                                                onFocus={e => {
                                                    e.currentTarget.style.border = '1px solid rgba(10,132,255,0.60)';
                                                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(10,132,255,0.12)';
                                                }}
                                                onBlur={e => {
                                                    e.currentTarget.style.border = '1px solid rgba(255,255,255,0.10)';
                                                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                                                    e.currentTarget.style.boxShadow = 'none';
                                                }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(v => !v)}
                                                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5"
                                                style={{ color: 'rgba(235,235,245,0.30)' }}
                                                tabIndex={-1}
                                            >
                                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Confirm Password */}
                                    <div className="space-y-2">
                                        <label
                                            htmlFor="confirmPassword"
                                            className="block text-xs font-semibold uppercase"
                                            style={{ color: 'rgba(235,235,245,0.50)', letterSpacing: '0.06em' }}
                                        >
                                            Confirm Password
                                        </label>
                                        <div className="relative">
                                            <Lock
                                                className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                                                style={{ color: 'rgba(235,235,245,0.30)' }}
                                            />
                                            <input
                                                id="confirmPassword"
                                                name="confirmPassword"
                                                type={showConfirm ? 'text' : 'password'}
                                                placeholder="••••••••"
                                                required
                                                className="w-full h-12 pl-10 pr-11 rounded-xl text-sm outline-none transition-all"
                                                style={{
                                                    background: 'rgba(255,255,255,0.06)',
                                                    border: '1px solid rgba(255,255,255,0.10)',
                                                    color: 'rgba(255,255,255,0.90)',
                                                    caretColor: '#0A84FF',
                                                }}
                                                onFocus={e => {
                                                    e.currentTarget.style.border = '1px solid rgba(10,132,255,0.60)';
                                                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(10,132,255,0.12)';
                                                }}
                                                onBlur={e => {
                                                    e.currentTarget.style.border = '1px solid rgba(255,255,255,0.10)';
                                                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                                                    e.currentTarget.style.boxShadow = 'none';
                                                }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirm(v => !v)}
                                                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5"
                                                style={{ color: 'rgba(235,235,245,0.30)' }}
                                                tabIndex={-1}
                                            >
                                                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isPending || !accessToken}
                                        className="w-full h-12 rounded-xl inline-flex items-center justify-center gap-2 text-sm font-semibold transition-opacity mt-2 disabled:cursor-not-allowed"
                                        style={{
                                            background: '#0A84FF',
                                            color: '#fff',
                                            opacity: isPending || !accessToken ? 0.6 : 1,
                                            boxShadow: '0 2px 10px rgba(10,132,255,0.30)',
                                        }}
                                        onMouseEnter={e => { if (!isPending && accessToken) e.currentTarget.style.opacity = '0.9'; }}
                                        onMouseLeave={e => { if (!isPending && accessToken) e.currentTarget.style.opacity = '1'; }}
                                    >
                                        {isPending ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <>
                                                Update Password
                                                <ArrowRight className="h-4 w-4" />
                                            </>
                                        )}
                                    </button>
                                </form>

                                <button
                                    type="button"
                                    onClick={() => router.push('/')}
                                    className="w-full text-center text-[13px] font-medium transition-colors"
                                    style={{ color: 'rgba(235,235,245,0.45)', background: 'none', border: 'none', cursor: 'pointer' }}
                                    onMouseEnter={e => (e.currentTarget.style.color = '#0A84FF')}
                                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(235,235,245,0.45)')}
                                >
                                    Back to Login
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
