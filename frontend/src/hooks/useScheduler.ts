import { useEffect, useRef } from 'react';
import type { AlarmItem } from '../types';
import * as API from '../services/api';

export function useScheduler(items: AlarmItem[], playedIds: Set<string>, markPlayed: (id: string, status: 'SENT' | 'FAILED') => void, isAudioEnabled: boolean) {
    const triggeredAlarms = useRef<Set<string>>(new Set());

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
