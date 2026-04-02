export type AudioTestLanguage = 'th' | 'en';

export type AudioTestMode = 'asset' | 'tts' | 'beep';

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

const TEST_AUDIO_ASSETS: Partial<Record<AudioTestLanguage, string>> = {
    th: import.meta.env.VITE_TEST_AUDIO_TH_URL,
    en: import.meta.env.VITE_TEST_AUDIO_EN_URL
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

async function waitForVoices(): Promise<SpeechSynthesisVoice[]> {
    const synth = window.speechSynthesis;
    const voices = synth.getVoices();
    if (voices.length > 0) {
        return voices;
    }

    return new Promise<SpeechSynthesisVoice[]>((resolve) => {
        const handleVoicesChanged = () => {
            window.clearTimeout(timeoutId);
            synth.removeEventListener('voiceschanged', handleVoicesChanged);
            resolve(synth.getVoices());
        };

        const timeoutId = window.setTimeout(() => {
            synth.removeEventListener('voiceschanged', handleVoicesChanged);
            resolve(synth.getVoices());
        }, 1200);

        synth.addEventListener('voiceschanged', handleVoicesChanged);
    });
}

function findVoiceForLanguage(voices: SpeechSynthesisVoice[], language: AudioTestLanguage) {
    const langPrefix = language === 'th' ? 'th' : 'en';
    const exactLang = language === 'th' ? 'th-th' : 'en-us';

    return voices.find((voice) => voice.lang.toLowerCase() === exactLang)
        || voices.find((voice) => voice.lang.toLowerCase().startsWith(`${langPrefix}-`))
        || voices.find((voice) => voice.lang.toLowerCase().startsWith(langPrefix));
}

async function playRecordedAnnouncement(url: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const audio = new Audio(url);
        audio.preload = 'auto';
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error(`Failed to play audio asset: ${url}`));
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(reject);
        }
    });
}

async function speakAnnouncement(language: AudioTestLanguage, message: { text: string; lang: string }): Promise<boolean> {
    if (!('speechSynthesis' in window)) {
        return false;
    }

    const voices = await waitForVoices();
    const selectedVoice = findVoiceForLanguage(voices, language);

    if (!selectedVoice) {
        return false;
    }

    await new Promise<void>((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(message.text);
        utterance.lang = selectedVoice.lang || message.lang;
        utterance.voice = selectedVoice;
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;
        utterance.onend = () => resolve();
        utterance.onerror = () => reject(new Error('Speech synthesis failed'));
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    });

    return true;
}

export async function playTestAnnouncement(language: AudioTestLanguage): Promise<AudioTestResult> {
    const message = TEST_MESSAGES[language];
    const testAssetUrl = TEST_AUDIO_ASSETS[language];

    if (testAssetUrl) {
        try {
            await playRecordedAnnouncement(testAssetUrl);
            return { mode: 'asset' };
        } catch (error) {
            console.warn('Configured test audio asset failed, falling back to TTS/beep', error);
        }
    }

    try {
        const spoke = await speakAnnouncement(language, message);
        if (spoke) {
            return { mode: 'tts' };
        }
    } catch {
        // Fall through to beep.
    }

    await playFallbackBeep();
    return { mode: 'beep' };
}
