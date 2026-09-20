import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Channel, ChannelSession } from '../types';
import * as API from '../services/api';
import {
    clearChannelSession,
    loadChannelSession,
    newChannelToken,
    saveChannelSession,
} from '../services/channelSession';
import { stopAlarm } from '../utils/audio';

const RENEW_INTERVAL_MS = 10_000;
// The server lease is 30s; after this long without a successful renewal it has certainly expired.
const LEASE_GIVE_UP_MS = 28_000;
const PROBE_WAIT_MS = 150;

type ChannelStatus = 'checking' | 'idle' | 'active';

interface ChannelContextType {
    status: ChannelStatus;
    session: ChannelSession | null;
    leaseConfirmed: boolean;
    channels: Channel[];
    notice: string | null;
    refreshChannels: () => Promise<void>;
    selectChannel: (channel: Channel) => Promise<void>;
    createChannel: (name: string) => Promise<boolean>;
    deleteChannel: (channel: Channel) => Promise<void>;
    renameChannel: (name: string) => Promise<string | null>;
    leaveChannel: () => Promise<void>;
    handleLeaseLost: () => void;
}

const ChannelContext = createContext<ChannelContextType | undefined>(undefined);

function isDefinitiveLoss(error: unknown) {
    return error instanceof API.ApiError && [400, 404, 409].includes(error.status);
}

export function ChannelProvider({ children }: { children: ReactNode }) {
    const [status, setStatus] = useState<ChannelStatus>('checking');
    const [session, setSession] = useState<ChannelSession | null>(null);
    const [leaseConfirmed, setLeaseConfirmed] = useState(false);
    const [channels, setChannels] = useState<Channel[]>([]);
    const [notice, setNotice] = useState<string | null>(null);
    const sessionRef = useRef<ChannelSession | null>(null);
    const lastRenewOkRef = useRef(0);

    const endSession = useCallback((message: string | null) => {
        stopAlarm();
        clearChannelSession();
        sessionRef.current = null;
        setSession(null);
        setLeaseConfirmed(false);
        setStatus('idle');
        setNotice(message);
    }, []);

    const activate = useCallback((next: ChannelSession) => {
        saveChannelSession(next);
        sessionRef.current = next;
        lastRenewOkRef.current = Date.now();
        setSession(next);
        setLeaseConfirmed(true);
        setStatus('active');
        setNotice(null);
    }, []);

    const refreshChannels = useCallback(async () => {
        try {
            setChannels(await API.getChannels());
        } catch (e) {
            console.error('Failed to load channels', e);
        }
    }, []);

    // Answer probes from a duplicated tab (which clones sessionStorage) while we own a channel.
    useEffect(() => {
        if (typeof BroadcastChannel === 'undefined') return;
        const bc = new BroadcastChannel('alarm-channel-owner');
        bc.onmessage = (event) => {
            const data = event.data;
            if (data?.type === 'probe' && data.channelId === sessionRef.current?.channelId) {
                bc.postMessage({ type: 'occupied', channelId: data.channelId });
            }
        };
        return () => bc.close();
    }, []);

    // Restore a stored session after a reload, unless another tab of this browser already owns it.
    useEffect(() => {
        let cancelled = false;

        const isOccupiedElsewhere = (channelId: string) =>
            new Promise<boolean>((resolve) => {
                if (typeof BroadcastChannel === 'undefined') return resolve(false);
                const probe = new BroadcastChannel('alarm-channel-owner');
                const timer = window.setTimeout(() => {
                    probe.close();
                    resolve(false);
                }, PROBE_WAIT_MS);
                probe.onmessage = (event) => {
                    if (event.data?.type === 'occupied' && event.data.channelId === channelId) {
                        window.clearTimeout(timer);
                        probe.close();
                        resolve(true);
                    }
                };
                probe.postMessage({ type: 'probe', channelId });
            });

        (async () => {
            const stored = loadChannelSession();
            if (!stored) {
                if (!cancelled) setStatus('idle');
                return;
            }
            if (await isOccupiedElsewhere(stored.channelId)) {
                if (!cancelled) endSession('ช่องนี้เปิดอยู่ในแท็บอื่นของเบราว์เซอร์นี้');
                return;
            }
            try {
                await API.lockChannel(stored.channelId, stored.token);
                if (!cancelled) activate(stored);
            } catch {
                if (!cancelled) endSession(null);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [activate, endSession]);

    const renew = useCallback(async () => {
        const current = sessionRef.current;
        if (!current) return;
        try {
            await API.lockChannel(current.channelId, current.token);
            lastRenewOkRef.current = Date.now();
            setLeaseConfirmed(true);
        } catch (e) {
            if (isDefinitiveLoss(e) || Date.now() - lastRenewOkRef.current > LEASE_GIVE_UP_MS) {
                endSession('หมดสิทธิ์ใช้ช่องนี้แล้ว (มีการใช้งานจากที่อื่น หรือการเชื่อมต่อขาดหาย)');
            } else {
                setLeaseConfirmed(false);
            }
        }
    }, [endSession]);

    // Renew the lease while a channel is open, even in a hidden tab (the browser may throttle the timer).
    useEffect(() => {
        if (status !== 'active') return;
        const interval = window.setInterval(() => void renew(), RENEW_INTERVAL_MS);
        return () => window.clearInterval(interval);
    }, [status, renew]);

    // After the tab was hidden, do not let the scheduler resume until the lease is confirmed again.
    useEffect(() => {
        if (status !== 'active') return;
        const onVisibility = () => {
            if (document.visibilityState !== 'visible') return;
            setLeaseConfirmed(false);
            void renew();
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, [status, renew]);

    const selectChannel = useCallback(async (channel: Channel) => {
        const token = newChannelToken();
        try {
            await API.lockChannel(channel.id, token);
            activate({ channelId: channel.id, token, name: channel.name });
        } catch (e) {
            setNotice(e instanceof API.ApiError && e.status === 409
                ? `ช่อง "${channel.name}" กำลังถูกใช้งานอยู่`
                : 'เลือกช่องไม่สำเร็จ ลองใหม่อีกครั้ง');
            await refreshChannels();
        }
    }, [activate, refreshChannels]);

    const createChannel = useCallback(async (name: string) => {
        try {
            await API.createChannel(name);
            setNotice(null);
            await refreshChannels();
            return true;
        } catch (e) {
            setNotice(e instanceof Error ? e.message : 'สร้างช่องไม่สำเร็จ');
            return false;
        }
    }, [refreshChannels]);

    const deleteChannel = useCallback(async (channel: Channel) => {
        try {
            await API.deleteChannel(channel.id, newChannelToken());
            setNotice(null);
        } catch (e) {
            setNotice(e instanceof Error ? e.message : 'ลบช่องไม่สำเร็จ');
        }
        await refreshChannels();
    }, [refreshChannels]);

    const renameChannel = useCallback(async (name: string) => {
        const current = sessionRef.current;
        if (!current) return null;
        try {
            const updated = await API.renameChannel(current, name);
            const next = { ...current, name: updated.name };
            sessionRef.current = next;
            saveChannelSession(next);
            setSession(next);
            return null;
        } catch (e) {
            return e instanceof Error ? e.message : 'เปลี่ยนชื่อไม่สำเร็จ';
        }
    }, []);

    const leaveChannel = useCallback(async () => {
        const current = sessionRef.current;
        stopAlarm();
        endSession(null);
        if (current) {
            try {
                await API.unlockChannel(current.channelId, current.token);
            } catch (e) {
                console.error('Failed to release channel (it will expire on its own)', e);
            }
        }
    }, [endSession]);

    const handleLeaseLost = useCallback(() => {
        endSession('หมดสิทธิ์ใช้ช่องนี้แล้ว (มีการใช้งานจากที่อื่น)');
    }, [endSession]);

    const value = useMemo(() => ({
        status,
        session,
        leaseConfirmed,
        channels,
        notice,
        refreshChannels,
        selectChannel,
        createChannel,
        deleteChannel,
        renameChannel,
        leaveChannel,
        handleLeaseLost,
    }), [status, session, leaseConfirmed, channels, notice, refreshChannels, selectChannel, createChannel, deleteChannel, renameChannel, leaveChannel, handleLeaseLost]);

    return <ChannelContext.Provider value={value}>{children}</ChannelContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useChannel() {
    const context = useContext(ChannelContext);
    if (context === undefined) {
        throw new Error('useChannel must be used within a ChannelProvider');
    }
    return context;
}
