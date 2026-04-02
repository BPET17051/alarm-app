const AUDIO_EXTENSION_PATTERN = /\.(mp3|wav|ogg|aac|m4a|flac)$/i;
export const AUDIO_DISPLAY_NAME_MAX_LENGTH = 40;

export function stripAudioExtension(raw: string): string {
    return raw.trim().replace(AUDIO_EXTENSION_PATTERN, '');
}

export function sanitizeAudioDisplayName(
    raw: string | null | undefined,
    fallback = 'Default Alarm Sound'
): string {
    const trimmed = stripAudioExtension(raw || '').replace(/\s+/g, ' ').trim();
    if (!trimmed) return fallback;
    return trimmed.slice(0, AUDIO_DISPLAY_NAME_MAX_LENGTH);
}

export function formatAudioName(
    raw: string | null | undefined,
    fallback = 'Default Alarm Sound'
): string {
    return sanitizeAudioDisplayName(raw, fallback);
}

// ---------------------------------------------------------------------------
// Playback
// ---------------------------------------------------------------------------

export type PlaybackResult = 'audio' | 'beep' | 'failed';

/**
 * Plays the alarm audio for a given URL, returning a promise that resolves
 * when playback ends. `onended` / `onerror` are registered before `play()`
 * to avoid the race condition where a very short clip fires `ended` before
 * the handlers are attached.
 */
export function playAudioFile(url: string): Promise<PlaybackResult> {
    return new Promise((resolve) => {
        const audio = new Audio(url);
        audio.preload = 'auto';

        // Attach handlers BEFORE calling play() to avoid race condition
        audio.onended = () => resolve('audio');
        audio.onerror = () => resolve('failed');

        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => resolve('failed'));
        }
    });
}

/**
 * Plays a two-tone beep using the Web Audio API.
 * Mirrors the sound used in audioTest.ts → playFallbackBeep().
 */
export async function playBeepFallback(): Promise<PlaybackResult> {
    const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) return 'failed';

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') await ctx.resume();

    const playTone = (startAt: number, duration: number, frequency: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startAt);
        osc.stop(startAt + duration + 0.02);
    };

    const base = ctx.currentTime + 0.02;
    playTone(base, 0.22, 880);
    playTone(base + 0.32, 0.22, 1174);

    return new Promise((resolve) => {
        window.setTimeout(() => {
            void ctx.close();
            resolve('beep');
        }, 800);
    });
}

/**
 * High-level alarm playback: plays the audio file if `audioUrl` is provided,
 * otherwise falls back to a beep.
 */
export async function playAlarm(audioUrl: string | null): Promise<PlaybackResult> {
    if (audioUrl) {
        const result = await playAudioFile(audioUrl);
        if (result !== 'failed') return result;
    }
    return playBeepFallback();
}
