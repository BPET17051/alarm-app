export interface AlarmItem {
    id: string;
    h: number;
    m: number;
    s: number;
    audioId: string | null;
    audioDisplayName: string;
    notify_status: 'PENDING' | 'SENT' | 'FAILED';
}

export type TemplateItem = Pick<AlarmItem, 'h' | 'm' | 's' | 'audioId' | 'audioDisplayName'>;

export interface Template {
    name: string;
    items: TemplateItem[];
}

export interface Channel {
    id: string;
    name: string;
    locked: boolean;
    expiresAt: string | null;
}

export interface ChannelSession {
    channelId: string;
    token: string;
    name: string;
}

export interface AudioFile {
    id: string;
    displayName: string;
    fileName: string;
    url: string;
    size?: number;
    created_at?: string;
}
