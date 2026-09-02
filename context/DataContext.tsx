"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { consolidateLeads, ConsolidatedLead } from "@/lib/leads-utils";
import { isReplyTrackPositive } from "@/lib/outreach-types";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { useRouter } from 'next/navigation';
import { logout } from '@/app/actions/auth';

export interface MasterMetrics {
    totalLeads: number;
    oldestLeadDate: string | null;
    totalWaReachouts: number;
    totalWaReplies: number;
    totalEmailsSent: number;
    totalEmailReplies: number;
    totalVoiceCalls: number;
    voiceCallCost: number;
    leadsDaily: { date: string; leads: number }[];
    // legacy keys — still emitted by the API, kept for older components
    ownerVoiceCalls: number;
    normalVapiCost: number;
    ownerVapiCost: number;
    totalOwnerLeads: number;
    ownerWaReachouts: number;
    ownerWaReplies: number;
}

export interface WhatsappMetrics {
    totalReachouts: number;
    totalReplies: number;
    replyRate: number;
    totalMessagesSent: number;
    dailyTrend: { date: string; reachouts: number; replies: number }[];
    ownerReachouts: number;
    ownerReplies: number;
}

export interface VoiceMetrics {
    totalCalls: number;
    totalDuration: number;
    avgDuration: number;
    totalCost: number;
    avgCost: number;
    completedCalls: number;
    answeredCalls: number;
    successRate: number;
    b2bCalls: number;
    b2cCalls: number;
    b2bConnected: number;
    b2bQualified: number;
    b2bPickupRate: number;
    b2bCompletionRate: number;
    b2bPositiveCount: number;
    b2bPositiveRate: number;
    b2cConnected: number;
    b2cQualified: number;
    b2cPickupRate: number;
    b2cCompletionRate: number;
    b2cPositiveCount: number;
    b2cPositiveRate: number;
    allTimeB2bCalls: number;
    allTimeB2cCalls: number;
    dailyVolume: { date: string; calls: number; cost: number }[];
    hourlyDistribution: { hour: number; calls: number }[];
    durationBuckets: { label: string; calls: number }[];
    costByDay: { date: string; calls: number; cost: number }[];
    positiveCount: number;
    recordingCount: number;
    sentimentBreakdown: { positive: number; negative: number; neutral: number };
}

interface DataContextType {
    leads: ConsolidatedLead[];
    calls: any[];
    ownerLeads: any[];
    allTimeVoiceCount: number;
    allTimeOwnerVoiceCount: number;
    loadingLeads: boolean;
    loadingCalls: boolean;
    loadingOwners: boolean;
    loadingBalances: boolean;
    loadingVoiceMetrics: boolean;
    loadingMasterMetrics: boolean;
    loadingWhatsappMetrics: boolean;
    voiceMetrics: VoiceMetrics | null;
    masterMetrics: MasterMetrics | null;
    whatsappMetrics: WhatsappMetrics | null;
    /** Total row count of public.master_leads, scoped by the active date range. */
    masterLeadsTotal: number | null;
    loadingMasterLeadsTotal: boolean;
    refreshMasterLeadsTotal: (params?: { from?: Date; to?: Date; force?: boolean }) => Promise<void>;
    voiceBalance: any;
    maqsamBalance: any;
    twilioBalance: any;
    error: string | null;
    refreshLeads: (params?: { from?: Date; to?: Date; force?: boolean }) => Promise<void>;
    refreshCalls: (params?: { from?: Date; to?: Date; includeElevenLabs?: boolean; provider?: string; force?: boolean }) => Promise<void>;
    refreshOwners: (params?: { from?: Date; to?: Date; force?: boolean }) => Promise<void>;
    refreshBalances: () => Promise<void>;
    refreshVoiceMetrics: (params?: { from?: Date; to?: Date; includeElevenLabs?: boolean; force?: boolean }) => Promise<void>;
    refreshMasterMetrics: (params?: { from?: Date; to?: Date; force?: boolean }) => Promise<void>;
    refreshWhatsappMetrics: (params?: { from?: Date; to?: Date; force?: boolean }) => Promise<void>;
    refreshAll: (params?: { from?: Date; to?: Date; includeElevenLabs?: boolean }) => Promise<void>;
    computeWPReplies: (dateRange?: { from?: Date; to?: Date } | null) => number;
}

export const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
    const [leads, setLeads] = useState<ConsolidatedLead[]>([]);
    const [calls, setCalls] = useState<any[]>([]);
    const [allTimeVoiceCount, setAllTimeVoiceCount] = useState(0);
    const [allTimeOwnerVoiceCount, setAllTimeOwnerVoiceCount] = useState(0);
    const [loadingLeads, setLoadingLeads] = useState(true);
    const [loadingCalls, setLoadingCalls] = useState(true);
    const [loadingBalances, setLoadingBalances] = useState(true);
    const [loadingVoiceMetrics, setLoadingVoiceMetrics] = useState(true);
    const [loadingMasterMetrics, setLoadingMasterMetrics] = useState(true);
    const [loadingWhatsappMetrics, setLoadingWhatsappMetrics] = useState(true);
    const [voiceMetrics, setVoiceMetrics] = useState<VoiceMetrics | null>(null);
    const [masterMetrics, setMasterMetrics] = useState<MasterMetrics | null>(null);
    const [whatsappMetrics, setWhatsappMetrics] = useState<WhatsappMetrics | null>(null);
    const [masterLeadsTotal, setMasterLeadsTotal] = useState<number | null>(null);
    const [loadingMasterLeadsTotal, setLoadingMasterLeadsTotal] = useState(true);
    const [voiceBalance, setVoiceBalance] = useState<any>(null);
    const [maqsamBalance, setMaqsamBalance] = useState<any>(null);
    const [twilioBalance, setTwilioBalance] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // Gatekeepers to prevent redundant identical calls
    const lastCallParams = useRef<string | null>(null);
    const lastVoiceMetricsParams = useRef<string | null>(null);

    const fetchLeads = useCallback(async (params?: { from?: Date; to?: Date; force?: boolean }) => {
        setLoadingLeads(true);
        try {
            const query = new URLSearchParams({
                from: 'all',
                to: 'all'
            });

            const response = await fetch(`/api/leads?${query.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch leads');
            const data = await response.json();
            const consolidated = consolidateLeads(data);
            setLeads(consolidated);
        } catch (err: any) {
            console.error('DataProvider leads fetch error:', err);
            setError(err.message);
        } finally {
            setLoadingLeads(false);
        }
    }, []);

    const fetchCalls = useCallback(async (params?: { from?: Date; to?: Date; includeElevenLabs?: boolean; provider?: string; force?: boolean }) => {
        try {
            // Normalize defaults to Last 7 Days (Start of Day) to ensure stable query strings across components
            // Using full-day boundaries (12am - 12pm) ensures identical cache keys for the entire day.
            const now = new Date();
            const fromDate = params?.from ? startOfDay(params.from) : subDays(startOfDay(now), 7);
            const toDate = params?.to ? endOfDay(params.to) : endOfDay(now);
            const includeElevenLabs = params?.includeElevenLabs || false;
            const provider = params?.provider || 'vapi';

            if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
                console.error("Invalid dates passed to fetchCalls");
                return;
            }

            const query = new URLSearchParams({
                from: fromDate.toISOString(),
                to: toDate.toISOString(),
                includeElevenLabs: String(includeElevenLabs),
                provider
            });

            const currentQuery = query.toString();

            // Skip if requested params are identical to the last SUCCESSFUL or ONGOING load
            // But ALLOW if forced refresh or if calls array is currently empty
            if (!params?.force && lastCallParams.current === currentQuery && (calls.length > 0 || loadingCalls)) {
                return;
            }

            setLoadingCalls(true);
            lastCallParams.current = currentQuery;

            const response = await fetch(`/api/calls?${currentQuery}`);
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data)) setCalls(data);
            } else {
                // If failed, clear last params to allow retry
                lastCallParams.current = null;
            }
        } catch (err: any) {
            console.error('DataProvider calls fetch error:', err);
            lastCallParams.current = null;
        } finally {
            setLoadingCalls(false);
        }
    }, []);

    const hasVoiceMetrics = useRef(false);

    const fetchVoiceMetrics = useCallback(async (params?: { from?: Date; to?: Date; includeElevenLabs?: boolean; force?: boolean }) => {
        try {
            const now = new Date();
            const fromDate = params?.from ? startOfDay(params.from) : subDays(startOfDay(now), 7);
            const toDate = params?.to ? endOfDay(params.to) : endOfDay(now);
            const includeElevenLabs = params?.includeElevenLabs || false;

            const query = new URLSearchParams({
                from: fromDate.toISOString(),
                to: toDate.toISOString(),
                includeElevenLabs: String(includeElevenLabs),
            });

            const currentQuery = query.toString();
            if (!params?.force && lastVoiceMetricsParams.current === currentQuery && hasVoiceMetrics.current) {
                return;
            }

            setLoadingVoiceMetrics(true);
            lastVoiceMetricsParams.current = currentQuery;

            const response = await fetch(`/api/metrics/voice?${currentQuery}`);
            if (response.ok) {
                const data: VoiceMetrics = await response.json();
                setVoiceMetrics(data);
                hasVoiceMetrics.current = true;
                // Keep legacy allTime counters in sync
                setAllTimeVoiceCount(data.allTimeB2bCalls);
                setAllTimeOwnerVoiceCount(data.allTimeB2cCalls);
            } else {
                lastVoiceMetricsParams.current = null;
            }
        } catch (err: any) {
            console.error('DataProvider voice metrics fetch error:', err);
            lastVoiceMetricsParams.current = null;
        } finally {
            setLoadingVoiceMetrics(false);
        }
    }, []);

    const lastMasterMetricsParams = useRef<string | null>(null);
    const hasMasterMetrics = useRef(false);

    const fetchMasterMetrics = useCallback(async (params?: { from?: Date; to?: Date; force?: boolean }) => {
        try {
            const now = new Date();
            const fromDate = params?.from ? startOfDay(params.from) : subDays(startOfDay(now), 7);
            const toDate = params?.to ? endOfDay(params.to) : endOfDay(now);

            const query = new URLSearchParams({
                from: fromDate.toISOString(),
                to: toDate.toISOString(),
            });

            const currentQuery = query.toString();
            if (!params?.force && lastMasterMetricsParams.current === currentQuery && hasMasterMetrics.current) {
                return;
            }

            setLoadingMasterMetrics(true);
            lastMasterMetricsParams.current = currentQuery;

            const response = await fetch(`/api/metrics/master?${currentQuery}`);
            if (response.ok) {
                const data: MasterMetrics = await response.json();
                setMasterMetrics(data);
                hasMasterMetrics.current = true;
            } else {
                lastMasterMetricsParams.current = null;
            }
        } catch (err: any) {
            console.error('DataProvider master metrics fetch error:', err);
            lastMasterMetricsParams.current = null;
        } finally {
            setLoadingMasterMetrics(false);
        }
    }, []);

    const lastWhatsappMetricsParams = useRef<string | null>(null);
    const hasWhatsappMetrics = useRef(false);

    const fetchWhatsappMetrics = useCallback(async (params?: { from?: Date; to?: Date; force?: boolean }) => {
        try {
            const now = new Date();
            const fromDate = params?.from ? startOfDay(params.from) : subDays(startOfDay(now), 7);
            const toDate = params?.to ? endOfDay(params.to) : endOfDay(now);

            const query = new URLSearchParams({
                from: fromDate.toISOString(),
                to: toDate.toISOString(),
            });

            const currentQuery = query.toString();
            if (!params?.force && lastWhatsappMetricsParams.current === currentQuery && hasWhatsappMetrics.current) {
                return;
            }

            setLoadingWhatsappMetrics(true);
            lastWhatsappMetricsParams.current = currentQuery;

            const response = await fetch(`/api/metrics/whatsapp?${currentQuery}`);
            if (response.ok) {
                const data: WhatsappMetrics = await response.json();
                setWhatsappMetrics(data);
                hasWhatsappMetrics.current = true;
            } else {
                lastWhatsappMetricsParams.current = null;
            }
        } catch (err: any) {
            console.error('DataProvider whatsapp metrics fetch error:', err);
            lastWhatsappMetricsParams.current = null;
        } finally {
            setLoadingWhatsappMetrics(false);
        }
    }, []);

    const lastMasterLeadsTotalParams = useRef<string | null>(null);
    const hasMasterLeadsTotal = useRef(false);

    const fetchMasterLeadsTotal = useCallback(async (params?: { from?: Date; to?: Date; force?: boolean }) => {
        try {
            const now = new Date();
            const fromDate = params?.from ? startOfDay(params.from) : subDays(startOfDay(now), 7);
            const toDate = params?.to ? endOfDay(params.to) : endOfDay(now);

            const query = new URLSearchParams({
                from: fromDate.toISOString(),
                to: toDate.toISOString(),
            });
            const currentQuery = query.toString();
            if (!params?.force && lastMasterLeadsTotalParams.current === currentQuery && hasMasterLeadsTotal.current) {
                return;
            }

            setLoadingMasterLeadsTotal(true);
            lastMasterLeadsTotalParams.current = currentQuery;

            const response = await fetch(`/api/metrics/master-leads?${currentQuery}`);
            if (response.ok) {
                const data: { totalLeads: number } = await response.json();
                setMasterLeadsTotal(data.totalLeads ?? 0);
                hasMasterLeadsTotal.current = true;
            } else {
                lastMasterLeadsTotalParams.current = null;
            }
        } catch (err: any) {
            console.error('DataProvider master-leads total fetch error:', err);
            lastMasterLeadsTotalParams.current = null;
        } finally {
            setLoadingMasterLeadsTotal(false);
        }
    }, []);

    const fetchBalances = useCallback(async () => {
        try {
            const [vapiRes, maqsamRes, twilioRes] = await Promise.all([
                fetch('/api/vapi/balance'),
                fetch('/api/maqsam/balance'),
                fetch('/api/twilio/balance')
            ]);
            if (vapiRes.ok) setVoiceBalance(await vapiRes.json());
            if (maqsamRes.ok) setMaqsamBalance(await maqsamRes.json());
            if (twilioRes.ok) setTwilioBalance(await twilioRes.json());
        } catch (err) { }
        finally { setLoadingBalances(false); }
    }, []);

    const refreshAll = useCallback(async (params?: { from?: Date; to?: Date; includeElevenLabs?: boolean }) => {
        await Promise.all([
            fetchLeads(params),
            fetchCalls(params),
            fetchBalances(),
            fetchVoiceMetrics(params),
            fetchMasterMetrics(params),
            fetchWhatsappMetrics(params),
            fetchMasterLeadsTotal(params),
        ]);
    }, [fetchLeads, fetchCalls, fetchBalances, fetchVoiceMetrics, fetchMasterMetrics, fetchWhatsappMetrics, fetchMasterLeadsTotal]);

    const router = useRouter();

    // Track whether we've already done the one-time 90-day fallback
    const didAutoExpand = useRef(false);

    // After the initial 7-day fetch completes, if we got no leads AND no owners,
    // re-fetch everything with a 90-day window so pages always have data to show.
    useEffect(() => {
        if (loadingLeads || loadingMasterMetrics || loadingWhatsappMetrics) return;
        if (didAutoExpand.current) return;
        didAutoExpand.current = true;

        if (leads.length === 0) {
            const from = subDays(startOfDay(new Date()), 90);
            const to = endOfDay(new Date());
            fetchLeads({ from, to });
        }
    }, [loadingLeads, loadingMasterMetrics, loadingWhatsappMetrics,
        leads, fetchLeads]);

    useEffect(() => {
        // Master Dashboard strategy: Fetch everything on mount
        refreshAll({ includeElevenLabs: false });

        // Session Monitor: Checks every 1 minute if the session is still valid
        const checkSession = async () => {
            try {
                const res = await fetch('/api/auth/session');
                if (!res.ok) {
                    // Session expired or invalid
                    await logout();
                    router.push('/');
                    router.refresh();
                }
            } catch (err) {
                console.error("Session check failed", err);
            }
        };

        const interval = setInterval(checkSession, 60000); // Check every 60 seconds
        return () => clearInterval(interval);
    }, [refreshAll, router]);

    const computeWPReplies = useCallback((dateRange?: { from?: Date; to?: Date } | null): number => {
        if (!leads) return 0;
        const fromDate = dateRange?.from ? startOfDay(new Date(dateRange.from)) : null;
        const toDate = dateRange?.to ? endOfDay(new Date(dateRange.to)) : (fromDate ? endOfDay(new Date(fromDate)) : null);

        const isWithinRange = (d: Date | null) => {
            if (!fromDate || !toDate) return true;
            if (!d) return false;
            return d >= fromDate && d <= toDate;
        };

        const seen = new Set<string>();
        let count = 0;

        leads.forEach((lead: any) => {
            const uid = lead.lead_id || lead.id || lead.phone;
            if (!uid || seen.has(uid)) return;
            seen.add(uid);

            if (!isReplyTrackPositive(lead.whatsapp_reply_track) && !lead.whatsapp_replied) return;

            // Best available reply timestamp
            const ref =
                lead.last_activity ||
                (lead.wa_slots?.length ? lead.wa_slots[lead.wa_slots.length - 1].sent_at : null) ||
                lead.updated_at ||
                lead.created_at;
            const d = ref ? new Date(ref) : null;
            if (isWithinRange(d && !isNaN(d.getTime()) ? d : null)) count++;
        });

        return count;
    }, [leads]);

    return (
        <DataContext.Provider value={{
            leads,
            calls,
            ownerLeads: [],
            allTimeVoiceCount,
            allTimeOwnerVoiceCount,
            loadingLeads,
            loadingCalls,
            loadingOwners: false,
            loadingBalances,
            loadingVoiceMetrics,
            loadingMasterMetrics,
            loadingWhatsappMetrics,
            voiceMetrics,
            masterMetrics,
            whatsappMetrics,
            masterLeadsTotal,
            loadingMasterLeadsTotal,
            voiceBalance,
            maqsamBalance,
            twilioBalance,
            error,
            refreshLeads: fetchLeads,
            refreshCalls: fetchCalls,
            refreshOwners: async () => {},
            refreshBalances: fetchBalances,
            refreshVoiceMetrics: fetchVoiceMetrics,
            refreshMasterMetrics: fetchMasterMetrics,
            refreshWhatsappMetrics: fetchWhatsappMetrics,
            refreshMasterLeadsTotal: fetchMasterLeadsTotal,
            refreshAll,
            computeWPReplies
        }}>
            {children}
        </DataContext.Provider>
    );
}

export function useData() {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
}
