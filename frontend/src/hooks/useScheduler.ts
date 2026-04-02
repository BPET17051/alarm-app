import { useEffect, useRef } from 'react';
import type { AlarmItem } from '../types';
import * as API from '../services/api';
import { playAlarm } from '../utils/audio';

export function useScheduler(
    items: AlarmItem[],
    playedIds: Set<string>,
    markPlayed: (id: string, status: 'SENT' | 'FAILED') => void,
    isAudioEnabled: boolean,
    dayKey: string,
    serverTime?: Date
) {
    const triggeredAlarms = useRef<Set<string>>(new Set());

    useEffect(() => {
        triggeredAlarms.current.clear();
    }, [dayKey]);

    useEffect(() => {
        const check = () => {
            // Use synced server time if available, otherwise fallback to local time
            const now = serverTime || new Date();
            const h = now.getHours();
            const m = now.getMinutes();
            const s = now.getSeconds();

            const nowTotalSeconds = h * 3600 + m * 60 + s;

            items.forEach(async (item) => {
                const itemS = item.s || 0;
                const itemTotalSeconds = item.h * 3600 + item.m * 60 + itemS;

                const diff = nowTotalSeconds - itemTotalSeconds;

                // Check if alarm is within window, not already played (server/context state), AND not currently triggering (local state)
                if (diff >= 0 && diff < 60 && !playedIds.has(item.id) && !triggeredAlarms.current.has(item.id)) {

                    // Lock immediately
                    triggeredAlarms.current.add(item.id);

                    if (!isAudioEnabled) {
                        console.warn('Audio not enabled, skipping playback');
                        markPlayed(item.id, 'FAILED');
                        return;
                    }

                    // Play audio — promise resolves after playback ends (or beep falls back)
                    try {
                        const audioUrl = item.audioId ? API.getAudioUrl(item.audioId) : null;
                        const result = await playAlarm(audioUrl);
                        markPlayed(item.id, result !== 'failed' ? 'SENT' : 'FAILED');
                    } catch (e) {
                        console.error(e);
                        markPlayed(item.id, 'FAILED');
                    }
                }
            });
        };

        const interval = setInterval(check, 1000); // Check every 1s
        check(); // Initial check

        return () => clearInterval(interval);
    }, [items, playedIds, markPlayed, isAudioEnabled, serverTime]);
}
