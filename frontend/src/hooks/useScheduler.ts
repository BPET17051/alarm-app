import { useEffect } from 'react';
import type { AlarmItem } from '../types';
import * as API from '../services/api';

export function useScheduler(items: AlarmItem[], playedIds: Set<string>, markPlayed: (id: string, status: 'SENT' | 'FAILED') => void, isAudioEnabled: boolean) {
    useEffect(() => {
        const check = () => {
            const now = new Date();
            const h = now.getHours();
            const m = now.getMinutes();
            const s = now.getSeconds();

            const nowTotalSeconds = h * 3600 + m * 60 + s;

            items.forEach(async (item) => {
                const itemS = item.s || 0;
                const itemTotalSeconds = item.h * 3600 + item.m * 60 + itemS;

                // Check if the alarm time is within the last 60 seconds (to handle throttling/lag)
                // and hasn't been played yet.
                // Handle day wrap-around (e.g. midnight) if needed, but for now assume same day.
                const diff = nowTotalSeconds - itemTotalSeconds;

                // We check if diff is between 0 and 2 to avoid re-triggering too old alarms if the user reloads,
                // but the user complained about "late", so maybe we should allow a larger window?
                // If the browser throttles to 1 minute, we need a window of at least 60s.
                // However, we rely on playedIds to prevent double playing.
                // Let's use a window of 60 seconds.

                if (diff >= 0 && diff < 60 && !playedIds.has(item.id)) {
                    if (!isAudioEnabled) {
                        console.warn('Audio not enabled, skipping playback');
                        markPlayed(item.id, 'FAILED');
                        return;
                    }

                    // Play audio
                    try {
                        if (item.audioId) {
                            const url = API.getAudioUrl(item.audioId);
                            const audio = new Audio(url);
                            const promise = audio.play();
                            if (promise !== undefined) {
                                await promise;
                            }
                            audio.onended = () => markPlayed(item.id, 'SENT');
                            audio.onerror = () => markPlayed(item.id, 'FAILED');
                        } else {
                            // Beep
                            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                            if (AudioContextClass) {
                                const ctx = new AudioContextClass();
                                const osc = ctx.createOscillator();
                                const gain = ctx.createGain();
                                osc.connect(gain);
                                gain.connect(ctx.destination);
                                osc.start();
                                setTimeout(() => {
                                    osc.stop();
                                    ctx.close();
                                    markPlayed(item.id, 'SENT');
                                }, 1000);
                            } else {
                                console.error('AudioContext not supported');
                                markPlayed(item.id, 'FAILED');
                            }
                        }
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
    }, [items, playedIds, markPlayed, isAudioEnabled]);
}
