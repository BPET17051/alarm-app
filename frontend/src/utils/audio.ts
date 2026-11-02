const AUDIO_EXTENSION_PATTERN = /\.(mp3|wav|ogg|aac|m4a|flac)$/i;
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F-\u009F]/g;
const ZERO_WIDTH_CHAR_PATTERN = new RegExp('[\\u200B-\\u200D\\uFEFF]', 'g');
const REPLACEMENT_CHAR_PATTERN = new RegExp('\\uFFFD', 'g');

export const AUDIO_DISPLAY_NAME_MAX_LENGTH = 40;

function normalizeDisplayText(raw: string): string {
    return raw
        .normalize('NFC')
        .replace(REPLACEMENT_CHAR_PATTERN, '')
        .replace(ZERO_WIDTH_CHAR_PATTERN, '')
        .replace(CONTROL_CHAR_PATTERN, ' ');
}

export function stripAudioExtension(raw: string): string {
    return normalizeDisplayText(raw).trim().replace(AUDIO_EXTENSION_PATTERN, '');
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

export type PlaybackResult = 'audio' | 'beep' | 'failed' | 'cancelled';

const activePlaybacks = new Set<() => void>();
let queueVersion = 0;
let activeUtterance: SpeechSynthesisUtterance | null = null;
let playbackQueue: Promise<PlaybackResult> = Promise.resolve('cancelled');

export function stopAlarm() {
    queueVersion += 1;
    window.speechSynthesis?.cancel();
    for (const cancel of Array.from(activePlaybacks)) cancel();
}

export function playAudioFile(url: string): Promise<PlaybackResult> {
    return new Promise((resolve) => {
        const audio = new Audio(url);
        audio.preload = 'auto';

        const finish = (result: PlaybackResult) => {
            activePlaybacks.delete(cancel);
            resolve(result);
        };
        const cancel = () => {
            audio.onended = null;
            audio.onerror = null;
            audio.pause();
            audio.src = '';
            finish('cancelled');
        };

        activePlaybacks.add(cancel);
        audio.onended = () => finish('audio');
        audio.onerror = () => finish('failed');

        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => finish('failed'));
        }
    });
}

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
        let timeoutId = 0;
        const finish = (result: PlaybackResult) => {
            activePlaybacks.delete(cancel);
            window.clearTimeout(timeoutId);
            void ctx.close().catch(() => undefined);
            resolve(result);
        };
        const cancel = () => finish('cancelled');

        activePlaybacks.add(cancel);
        timeoutId = window.setTimeout(() => finish('beep'), 800);
    });
}

// Slower than the default rate so the announcement is easy to follow, and said twice with pauses.
const TTS_RATE = 0.85;
const TTS_REPEATS = 2;
const TTS_PHRASE_PAUSE_MS = 400; // between short phrases (split by a comma)
const TTS_GROUP_PAUSE_MS = 900; // between groups / rooms (split by a new line)
const TTS_REPEAT_PAUSE_MS = 2000; // before the whole message is said again

// A line break separates groups, a comma separates short phrases inside a group. Words are never
// split any other way. Text without either separator stays a single phrase and is read continuously.
export function splitTtsText(text: string): string[][] {
    return text
        .split(/\r?\n/)
        .map(line => line.split(/[,，]/).map(phrase => phrase.trim()).filter(Boolean))
        .filter(phrases => phrases.length > 0);
}

// Waits without blocking Stop: stopAlarm() cancels it like any other playback. Resolves false when cancelled.
function pause(ms: number): Promise<boolean> {
    return new Promise(resolve => {
        const timer = window.setTimeout(() => {
            activePlaybacks.delete(cancel);
            resolve(true);
        }, ms);
        const cancel = () => {
            window.clearTimeout(timer);
            activePlaybacks.delete(cancel);
            resolve(false);
        };
        activePlaybacks.add(cancel);
    });
}

async function speakThai(text: string): Promise<PlaybackResult> {
    const version = queueVersion;
    const groups = splitTtsText(text);
    let last: PlaybackResult = 'failed';
    for (let pass = 0; pass < TTS_REPEATS; pass++) {
        if (pass > 0 && !(await pause(TTS_REPEAT_PAUSE_MS))) return 'cancelled';
        for (let g = 0; g < groups.length; g++) {
            for (let p = 0; p < groups[g].length; p++) {
                if (g > 0 || p > 0) {
                    const gap = p === 0 ? TTS_GROUP_PAUSE_MS : TTS_PHRASE_PAUSE_MS;
                    if (!(await pause(gap))) return 'cancelled';
                }
                if (version !== queueVersion) return 'cancelled';
                // Each phrase is spoken to its end (queue + watchdog of speakOnce) before the next pause starts.
                last = await speakOnce(groups[g][p], TTS_RATE);
                if (last !== 'audio') return last;
            }
        }
    }
    return last;
}

async function speakOnce(text: string, rate: number): Promise<PlaybackResult> {
    if (!('speechSynthesis' in window)) return 'failed';
    const synth = window.speechSynthesis;
    const findThaiVoice = () => synth.getVoices().find(item => {
        const lang = item.lang.toLowerCase();
        return lang === 'th-th' || lang.startsWith('th-') || lang === 'th';
    });
    let voice = findThaiVoice();
    if (!voice && synth.getVoices().length === 0) {
        voice = await new Promise<SpeechSynthesisVoice | undefined>(resolve => {
            const onVoicesChanged = () => {
                synth.removeEventListener('voiceschanged', onVoicesChanged);
                resolve(findThaiVoice());
            };
            synth.addEventListener('voiceschanged', onVoicesChanged, { once: true });
            window.setTimeout(() => {
                synth.removeEventListener('voiceschanged', onVoicesChanged);
                resolve(findThaiVoice());
            }, 1200);
        });
    }
    if (!voice) return 'failed';
    return new Promise(resolve => {
        const utterance = new SpeechSynthesisUtterance(text);
        // Chrome's stable path is language-selected; assigning a cached Voice object
        // can raise speech-error on Windows even when the same voice is available.
        utterance.lang = 'th-TH';
        utterance.rate = rate;
        // Keep a reference until the utterance ends. Chrome can drop an unreferenced utterance,
        // and then neither onend nor onerror fires.
        activeUtterance = utterance;
        let started = false;
        let finished = false;
        let watchdog = 0;
        const finish = (result: PlaybackResult) => {
            if (finished) return;
            finished = true;
            window.clearTimeout(watchdog);
            activePlaybacks.delete(cancel);
            if (activeUtterance === utterance) activeUtterance = null;
            resolve(result);
        };
        utterance.onstart = () => {
            started = true;
            console.debug('TTS speech started');
        };
        utterance.onend = () => finish('audio');
        utterance.onerror = (event) => {
            console.warn('TTS speech error:', event.error);
            finish('failed');
        };
        // Allow browser startup plus a generous speaking rate for long Thai text.
        watchdog = window.setTimeout(() => {
            console.warn(`TTS watchdog timeout (${started ? 'started' : 'not-started'}); stopping current utterance.`);
            if (activeUtterance === utterance) synth.cancel();
            finish('failed');
        }, 5000 + text.length * 500);
        const cancel = () => {
            if (activeUtterance === utterance) synth.cancel();
            finish('cancelled');
        };
        activePlaybacks.add(cancel);
        synth.speak(utterance);
    });
}

export async function playAlarm(audioUrl: string | null, ttsText?: string | null): Promise<PlaybackResult> {
    if (audioUrl) {
        const result = await playAudioFile(audioUrl);
        if (result === 'cancelled') return result;
        if (result === 'failed' && !ttsText?.trim()) return result;
    }

    if (ttsText?.trim()) return speakThai(ttsText.trim());

    return playBeepFallback();
}

export function enqueueAlarm(audioUrl: string | null, ttsText?: string | null): Promise<PlaybackResult> {
    const version = queueVersion;
    const next = playbackQueue.then(() => version === queueVersion ? playAlarm(audioUrl, ttsText) : 'cancelled');
    playbackQueue = next.catch(() => 'failed');
    return next;
}
