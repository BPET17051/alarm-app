import { useState, useEffect, useRef } from 'react';

interface TimeSyncState {
    /** Current server time (synced with Thailand time) */
    serverTime: Date;
    /** Offset in milliseconds between local time and server time (positive = local is ahead) */
    offset: number;
    /** Whether currently syncing with server */
    isSyncing: boolean;
    /** Error message if sync failed */
    error: string | null;
}

const SYNC_INTERVAL = 5 * 60 * 1000; // Re-sync every 5 minutes
const TIME_API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api') + '/time';

export function useTimeSync(): TimeSyncState {
    const [offset, setOffset] = useState(0);
    const [isSyncing, setIsSyncing] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const syncIntervalRef = useRef<number | undefined>(undefined);
    const clockIntervalRef = useRef<number | undefined>(undefined);

    // Function to sync time with server
    const syncTime = async () => {
        setIsSyncing(true);
        setError(null);

        try {
            const startTime = Date.now();
            const response = await fetch(TIME_API_URL);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const endTime = Date.now();

            // Account for network latency (round trip time / 2)
            const latency = (endTime - startTime) / 2;
            const serverTimestamp = new Date(data.iso).getTime();
            const adjustedServerTime = serverTimestamp + latency;

            // Calculate offset: positive means local clock is ahead
            const localTime = Date.now();
            const calculatedOffset = localTime - adjustedServerTime;

            setOffset(calculatedOffset);
            console.log(`⏱️ Time sync successful. Offset: ${(calculatedOffset / 1000).toFixed(1)}s (${calculatedOffset > 0 ? 'local ahead' : 'local behind'})`);
        } catch {
            // If sync fails, just log it debug and use local time (offset 0)
            console.debug('Time sync unavailable, using local device time.');
            // We don't set 'error' state to avoid showing scary messages to the user
            // since falling back to local time is the desired behavior for them.
        } finally {
            setIsSyncing(false);
        }
    };

    // Initial sync on mount
    useEffect(() => {
        syncTime();

        // Re-sync periodically
        syncIntervalRef.current = window.setInterval(() => {
            syncTime();
        }, SYNC_INTERVAL);

        return () => {
            if (syncIntervalRef.current) {
                clearInterval(syncIntervalRef.current);
            }
        };
    }, []);

    // Update clock every second
    useEffect(() => {
        clockIntervalRef.current = window.setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => {
            if (clockIntervalRef.current) {
                clearInterval(clockIntervalRef.current);
            }
        };
    }, []);

    // Calculate server time by subtracting offset from local time
    const serverTime = new Date(currentTime.getTime() - offset);

    return {
        serverTime,
        offset,
        isSyncing,
        error
    };
}
