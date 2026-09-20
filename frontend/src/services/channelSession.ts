import type { ChannelSession } from '../types';

const SESSION_KEY = 'alarm:channel-session';

export function loadChannelSession(): ChannelSession | null {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (typeof parsed?.channelId === 'string' && typeof parsed?.token === 'string') {
            return { channelId: parsed.channelId, token: parsed.token, name: String(parsed.name ?? '') };
        }
    } catch {
        // fall through to no session
    }
    return null;
}

export function saveChannelSession(session: ChannelSession) {
    try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
        // storage unavailable: the session simply won't survive a reload
    }
}

export function clearChannelSession() {
    try {
        sessionStorage.removeItem(SESSION_KEY);
    } catch {
        // nothing to clear
    }
}

// crypto.randomUUID only exists in secure contexts; kiosks may load the app over plain http on the LAN.
export function newChannelToken(): string {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
