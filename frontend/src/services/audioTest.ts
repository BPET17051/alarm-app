export type AudioTestLanguage = 'th' | 'en';

export type AudioTestMode = 'tts' | 'beep';

export interface AudioTestResult {
    mode: AudioTestMode;
}

const TEST_MESSAGES: Record<AudioTestLanguage, { text: string; lang: string }> = {
    th: {
        text: 'ขณะนี้กำลังทดสอบเสียงตามสายของระบบ',
        lang: 'th-TH'
    },
    en: {
        text: 'The public address system audio test is now in progress.',
        lang: 'en-US'
    }
};

export async function unlockBrowserAudio(): Promise<void> {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) {
        return;
    }

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
        await ctx.resume();
    }

    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);

    await new Promise<void>((resolve) => {
        source.onended = () => {
            void ctx.close();
            resolve();
        };
    });
}

export async function playFallbackBeep(): Promise<void> {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
        throw new Error('AudioContext not supported');
    }

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
        await ctx.resume();
    }

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

    await new Promise<void>((resolve) => {
        window.setTimeout(() => {
            void ctx.close();
            resolve();
        }, 800);
    });
}

export async function playTestAnnouncement(language: AudioTestLanguage): Promise<AudioTestResult> {
    const message = TEST_MESSAGES[language];

    if ('speechSynthesis' in window) {
        try {
            await new Promise<void>((resolve, reject) => {
                const utterance = new SpeechSynthesisUtterance(message.text);
                utterance.lang = message.lang;
                utterance.rate = 1;
                utterance.pitch = 1;
                utterance.volume = 1;
                utterance.onend = () => resolve();
                utterance.onerror = () => reject(new Error('Speech synthesis failed'));
                window.speechSynthesis.cancel();
                window.speechSynthesis.speak(utterance);
            });

            return { mode: 'tts' };
        } catch {
            await playFallbackBeep();
            return { mode: 'beep' };
        }
    }

    await playFallbackBeep();
    return { mode: 'beep' };
}
