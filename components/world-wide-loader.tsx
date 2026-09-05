"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";

interface WorldWideLoaderProps {
    /** Cover the whole viewport (default). Set false to overlay only the
     *  nearest positioned ancestor — used for in-panel table loads. */
    fullScreen?: boolean;
}

export const WorldWideLoader = ({ fullScreen = true }: WorldWideLoaderProps) => {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <div
            style={{
                position: fullScreen ? 'fixed' : 'absolute',
                inset: 0,
                zIndex: fullScreen ? 999 : 50,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--loader-scrim, rgba(10,10,15,0.88))',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                borderRadius: fullScreen ? 0 : 'inherit',
                opacity: mounted ? 1 : 0,
                transition: 'opacity 300ms ease',
            }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                {/* Spinner Ring with Icon centered inside */}
                <div style={{ position: 'relative', width: 76, height: 76, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {/* Glow */}
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(10,132,255,0.18)', filter: 'blur(16px)' }} className="animate-pulse" />
                    {/* Outer track */}
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid var(--hairline)' }} />
                    {/* Outer spinner */}
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid transparent', borderTopColor: 'var(--blue)' }} className="animate-spin" />
                    {/* Inner track */}
                    <div style={{ position: 'absolute', inset: 8, borderRadius: '50%', border: '1.5px solid var(--hairline)' }} />
                    {/* Inner spinner reverse */}
                    <div style={{ position: 'absolute', inset: 8, borderRadius: '50%', border: '1.5px solid transparent', borderBottomColor: 'var(--blue)' }} className="animate-[spin_1.5s_linear_infinite_reverse]" />
                    
                    {/* Center Globe Icon */}
                    <div style={{ position: 'relative', width: 34, height: 34, zIndex: 10 }}>
                        <Image src="/logo-icon.png" alt="" fill sizes="34px" className="object-contain" priority />
                    </div>
                </div>

                {/* Brand Text Logo */}
                <div style={{ position: 'relative', width: 170, height: 38, marginTop: 4 }}>
                    <Image src="/logo-full.png" alt="World Wide Real Estate" fill sizes="170px" className="object-contain" priority />
                </div>

                {/* Loading Dots */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 10, opacity: 0.7 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--blue)' }} className="animate-bounce" />
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--blue)', animationDelay: '150ms' }} className="animate-bounce" />
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--blue)', animationDelay: '300ms' }} className="animate-bounce" />
                </div>
            </div>
        </div>
    );
};

export default WorldWideLoader;
