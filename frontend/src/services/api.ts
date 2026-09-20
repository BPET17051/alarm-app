import type { AlarmItem, AudioFile, Channel, ChannelSession, Template, TemplateItem } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

type AlarmApiResponse = AlarmItem & {
    audioName?: string | null;
    audioDisplayName?: string | null;
};

type AudioFileApiResponse = AudioFile & {
    name?: string | null;
    displayName?: string | null;
    fileName?: string | null;
};

function normalizeAlarm(item: AlarmApiResponse): AlarmItem {
    return {
        ...item,
        audioDisplayName: item.audioDisplayName ?? item.audioName ?? '',
    };
}

function normalizeAudioFile(file: AudioFileApiResponse): AudioFile {
    const displayName = file.displayName ?? file.name ?? file.fileName ?? file.id;
    const fileName = file.fileName ?? file.name ?? file.displayName ?? file.id;

    return {
        ...file,
        displayName,
        fileName,
    };
}

export class ApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

async function failFrom(res: Response, fallback: string): Promise<never> {
    let message = fallback;
    try {
        const body = await res.json();
        if (body?.message) message = body.message;
    } catch {
        // keep fallback message
    }
    throw new ApiError(message, res.status);
}

const channelHeaders = (token: string) => ({ 'X-Channel-Token': token });
const alarmsUrl = (session: ChannelSession) => `${API_URL}/channels/${session.channelId}/alarms`;

export async function getChannels(): Promise<Channel[]> {
    const res = await fetch(`${API_URL}/channels`);
    if (!res.ok) return failFrom(res, 'Failed to fetch channels');
    return res.json();
}

export async function createChannel(name: string): Promise<Channel> {
    const res = await fetch(`${API_URL}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    });
    if (!res.ok) return failFrom(res, 'Failed to create channel');
    return res.json();
}

export async function lockChannel(channelId: string, token: string): Promise<{ expiresAt: string | null }> {
    const res = await fetch(`${API_URL}/channels/${channelId}/lock`, {
        method: 'POST',
        headers: channelHeaders(token),
    });
    if (!res.ok) return failFrom(res, 'Failed to lock channel');
    return res.json();
}

export async function unlockChannel(channelId: string, token: string): Promise<void> {
    const res = await fetch(`${API_URL}/channels/${channelId}/unlock`, {
        method: 'POST',
        headers: channelHeaders(token),
    });
    if (!res.ok) return failFrom(res, 'Failed to unlock channel');
}

export async function renameChannel(session: ChannelSession, name: string): Promise<Channel> {
    const res = await fetch(`${API_URL}/channels/${session.channelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...channelHeaders(session.token) },
        body: JSON.stringify({ name }),
    });
    if (!res.ok) return failFrom(res, 'Failed to rename channel');
    return res.json();
}

export async function deleteChannel(channelId: string, token: string): Promise<void> {
    const res = await fetch(`${API_URL}/channels/${channelId}`, {
        method: 'DELETE',
        headers: channelHeaders(token),
    });
    if (!res.ok) return failFrom(res, 'Failed to delete channel');
}

export async function getAlarms(session: ChannelSession): Promise<AlarmItem[]> {
    const res = await fetch(alarmsUrl(session), { headers: channelHeaders(session.token) });
    if (!res.ok) return failFrom(res, 'Failed to fetch alarms');
    const data: AlarmApiResponse[] = await res.json();
    return data.map(normalizeAlarm);
}

export async function createAlarm(session: ChannelSession, alarm: Omit<AlarmItem, 'id' | 'notify_status'>): Promise<AlarmItem> {
    const res = await fetch(alarmsUrl(session), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...channelHeaders(session.token) },
        body: JSON.stringify(alarm),
    });
    if (!res.ok) return failFrom(res, 'Failed to create alarm');
    const data: AlarmApiResponse = await res.json();
    return normalizeAlarm(data);
}

export async function updateAlarm(session: ChannelSession, id: string, updates: Partial<AlarmItem>): Promise<AlarmItem> {
    const res = await fetch(`${alarmsUrl(session)}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...channelHeaders(session.token) },
        body: JSON.stringify(updates),
    });
    if (!res.ok) return failFrom(res, 'Failed to update alarm');
    const data: AlarmApiResponse = await res.json();
    return normalizeAlarm(data);
}

export async function deleteAlarm(session: ChannelSession, id: string): Promise<void> {
    const res = await fetch(`${alarmsUrl(session)}/${id}`, {
        method: 'DELETE',
        headers: channelHeaders(session.token),
    });
    if (!res.ok) return failFrom(res, 'Failed to delete alarm');
}

export async function clearAlarms(session: ChannelSession): Promise<void> {
    const res = await fetch(alarmsUrl(session), {
        method: 'DELETE',
        headers: channelHeaders(session.token),
    });
    if (!res.ok) return failFrom(res, 'Failed to clear alarms');
}

export async function getAudioFiles(): Promise<AudioFile[]> {
    const res = await fetch(`${API_URL}/audio`);
    if (!res.ok) throw new Error('Failed to fetch audio files');
    const data: AudioFileApiResponse[] = await res.json();
    return data
        .map(normalizeAudioFile)
        .filter((file) => file.id !== '.emptyFolderPlaceholder');
}

export async function uploadAudio(file: File, displayName?: string): Promise<AudioFile> {
    const formData = new FormData();
    formData.append('file', file);
    if (displayName) {
        formData.append('displayName', displayName);
    }

    const res = await fetch(`${API_URL}/audio`, {
        method: 'POST',
        body: formData,
    });

    if (!res.ok) {
        if (res.status === 401) throw new Error('Unauthorized');

        let errorMsg = `Failed to upload audio: ${res.status} ${res.statusText}`;
        try {
            const errorData = await res.json();
            if (errorData.message) {
                errorMsg = `Upload failed: ${errorData.message}`;
            }
            if (errorData.error && typeof errorData.error === 'object') {
                errorMsg += ` (${JSON.stringify(errorData.error)})`;
            } else if (errorData.error) {
                errorMsg += ` (${errorData.error})`;
            }
        } catch {
            // Ignore json parse error, stick to default message
        }

        throw new Error(errorMsg);
    }
    const data: AudioFileApiResponse = await res.json();
    return normalizeAudioFile(data);
}

export async function deleteAudio(audioId: string): Promise<void> {
    const res = await fetch(`${API_URL}/audio/${encodeURIComponent(audioId)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete audio file');
}

export function getAudioUrl(id: string): string {
    return `${API_URL}/audio/${id}`;
}

function toTemplateItem(item: AlarmApiResponse): TemplateItem {
    return {
        h: item.h,
        m: item.m,
        s: item.s || 0,
        audioId: item.audioId ?? null,
        audioDisplayName: item.audioDisplayName ?? item.audioName ?? '',
    };
}

export async function getTemplates(): Promise<Template[]> {
    const res = await fetch(`${API_URL}/templates`);
    if (!res.ok) throw new Error('Failed to fetch templates');
    const data = await res.json();
    return data.templates.map((template: { name: string; items: AlarmApiResponse[] }) => ({
        name: template.name,
        items: template.items.map(toTemplateItem),
    }));
}

export async function saveTemplate(name: string, items: TemplateItem[]): Promise<void> {
    const res = await fetch(`${API_URL}/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, items }),
    });
    if (!res.ok) throw new Error('Failed to save template');
}

export async function deleteTemplate(name: string): Promise<void> {
    const res = await fetch(`${API_URL}/templates/${name}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete template');
}
