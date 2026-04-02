export interface AlarmItem {
    id: string;
    h: number;
    m: number;
    s: number;
    audioId: string | null;
    audioDisplayName: string;
    notify_status: 'PENDING' | 'SENT' | 'FAILED';
}

export interface Template {
    name: string;
    items: AlarmItem[];
}

export interface AudioFile {
    id: string;
    displayName: string;
    fileName: string;
    url: string;
    size?: number;
    created_at?: string;
}
