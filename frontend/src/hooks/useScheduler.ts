import { useEffect } from 'react';
import type { AlarmItem } from '../types';
import * as API from '../services/api';

export function useScheduler(items: AlarmItem[], playedIds: Set<string>, markPlayed: (id: string, status: 'SENT' | 'FAILED') => void) {
    useEffect(() => {
        const check = () => {
            const now = new Date();
            const h = now.getHours();
            const m = now.getMinutes();
            const s = now.getSeconds();

            items.forEach(async (item) => {
                const itemS = item.s || 0;
                if (item.h === h && item.m === m && itemS === s && !playedIds.has(item.id)) {
                    // Play audio
                    try {
                        if (item.audioId) {
                            const url = API.getAudioUrl(item.audioId);
                            const audio = new Audio(url);
                            audio.play();
                            audio.onended = () => markPlayed(item.id, 'SENT');
                            audio.onerror = () => markPlayed(item.id, 'FAILED');
                        } else {
                            // Beep
                            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
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
    }, [items, playedIds, markPlayed]);
}
