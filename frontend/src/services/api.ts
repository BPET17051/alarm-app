import type { AlarmItem, AudioFile } from '../types';

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

export async function getAlarms(): Promise<AlarmItem[]> {
    const res = await fetch(`${API_URL}/alarms`);
    if (!res.ok) throw new Error('Failed to fetch alarms');
    const data: AlarmApiResponse[] = await res.json();
    return data.map(normalizeAlarm);
}

export async function createAlarm(alarm: Omit<AlarmItem, 'id' | 'notify_status'>): Promise<AlarmItem> {
    const res = await fetch(`${API_URL}/alarms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alarm),
    });
    if (!res.ok) throw new Error('Failed to create alarm');
    const data: AlarmApiResponse = await res.json();
    return normalizeAlarm(data);
}

export async function updateAlarm(id: string, updates: Partial<AlarmItem>): Promise<AlarmItem> {
    const res = await fetch(`${API_URL}/alarms/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update alarm');
    const data: AlarmApiResponse = await res.json();
    return normalizeAlarm(data);
}

export async function deleteAlarm(id: string): Promise<void> {
    const res = await fetch(`${API_URL}/alarms/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete alarm');
}

export async function clearAlarms(): Promise<void> {
    const res = await fetch(`${API_URL}/alarms`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to clear alarms');
}

export async function getAudioFiles(): Promise<AudioFile[]> {
    const res = await fetch(`${API_URL}/audio`);
    if (!res.ok) throw new Error('Failed to fetch audio files');
    const data: AudioFileApiResponse[] = await res.json();
    return data.map(normalizeAudioFile);
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

export interface Template {
    name: string;
    items: AlarmItem[];
}

export async function getTemplates(): Promise<Template[]> {
    const res = await fetch(`${API_URL}/templates`);
    if (!res.ok) throw new Error('Failed to fetch templates');
    const data = await res.json();
    return data.templates.map((template: Template & { items: AlarmApiResponse[] }) => ({
        ...template,
        items: template.items.map(normalizeAlarm),
    }));
}

export async function saveTemplate(name: string, items: AlarmItem[]): Promise<void> {
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
