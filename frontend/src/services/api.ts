import type { AlarmItem } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export async function getAlarms(): Promise<AlarmItem[]> {
    const res = await fetch(`${API_URL}/alarms`);
    if (!res.ok) throw new Error('Failed to fetch alarms');
    return res.json();
}

export async function createAlarm(alarm: Omit<AlarmItem, 'id' | 'notify_status'>): Promise<AlarmItem> {
    const res = await fetch(`${API_URL}/alarms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alarm),
    });
    if (!res.ok) throw new Error('Failed to create alarm');
    return res.json();
}

export async function updateAlarm(id: string, updates: Partial<AlarmItem>): Promise<AlarmItem> {
    const res = await fetch(`${API_URL}/alarms/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update alarm');
    return res.json();
}

export async function deleteAlarm(id: string): Promise<void> {
    const res = await fetch(`${API_URL}/alarms/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete alarm');
}

export async function clearAlarms(): Promise<void> {
    const res = await fetch(`${API_URL}/alarms`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to clear alarms');
}

export async function uploadAudio(file: File): Promise<{ id: string; url: string }> {
    const formData = new FormData();
    formData.append('file', file);

    // Note: The backend requires authentication for uploads.
    // For this phase, we assume the backend might need to be relaxed or we need to implement auth.
    // However, looking at the backend code, `requireAuth` is used.
    // We might need to implement login or temporarily disable auth for testing.
    // For now, let's assume we need to handle auth later or the user is logged in.
    // But wait, the user hasn't implemented login in the frontend yet.
    // I should check if I can disable auth for audio upload or if I should implement a dummy login.
    // The README says "POST /api/auth/login – login with admin credentials".
    // I'll add a TODO to handle auth. For now, I'll try to upload.

    const res = await fetch(`${API_URL}/audio`, {
        method: 'POST',
        body: formData,
    });

    if (!res.ok) {
        if (res.status === 401) throw new Error('Unauthorized');
        throw new Error(`Failed to upload audio: ${res.status} ${res.statusText}`);
    }
    return res.json();
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
    return data.templates;
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
