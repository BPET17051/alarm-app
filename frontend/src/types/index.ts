export interface AlarmItem {
    id: string;
    h: number;
    m: number;
    s: number;
    audioId: string | null;
    audioName: string;
    notify_status: 'PENDING' | 'SENT' | 'FAILED';
}

export interface Template {
    name: string;
    items: AlarmItem[];
}

export interface AudioFile {
    id: string;
    name: string;
    type: string;
    blob: Blob;
}
