import type { AudioFile } from '../types';
import type { ImportedRow, SubSlot } from './scheduleImport';

export interface CprAnnouncement {
    sourceRowIndex: number;
    h: number;
    m: number;
    s: number;
    audioId: string | null;
    audioDisplayName: string;
    reason: string;
}

// Announcement names as they appear in the audio library. Matched after normalizing spaces and dashes.
const AUDIO = {
    alert: 'อีก10นาทีหมดเวลา',
    change: 'หมดเวลาเปลี่ยน-Sation',
    resume: 'หมดเวลาเริ่มเข้าฝึกปฏิบัติSation',
    examEnd: 'หมดเวลาสอบ',
    snackBreak: 'พักรับประทานอาหารว่าง',
    lunchBreak: 'พักรับประทานอาหารกลางวัน',
    shortBreak: 'พัก 15 นาที',
};

const ALERT_BEFORE_END = 10 * 60;
const PRACTICE_KEYWORD = 'ฝึกปฏิบัติ';
const BREAK_KEYWORD = 'พัก';

const normalize = (value: string) => value.toLowerCase().replace(/[\s._-]+/g, '');
const toSeconds = (h: number, m: number) => h * 3600 + m * 60;
const fromSeconds = (total: number) => {
    const normalized = ((total % 86400) + 86400) % 86400;
    return { h: Math.floor(normalized / 3600), m: Math.floor((normalized % 3600) / 60), s: normalized % 60 };
};

function findAudio(audioFiles: AudioFile[], name: string) {
    const target = normalize(name);
    const match = audioFiles.find(file => normalize(file.displayName) === target);
    return match
        ? { audioId: match.id, audioDisplayName: match.displayName }
        : { audioId: null, audioDisplayName: name };
}

function breakAudio(label: string) {
    if (label.includes('กลางวัน')) return { name: AUDIO.lunchBreak, reason: 'ประกาศพักกลางวัน' };
    if (/15\s*นาที/.test(label)) return { name: AUDIO.shortBreak, reason: 'ประกาศพัก 15 นาที' };
    return { name: AUDIO.snackBreak, reason: 'ประกาศพักว่าง' };
}

interface Window { start: number; end: number; exam: boolean }

interface Item {
    rowIndex: number;
    start: number;
    end: number;
    label: string;
    kind: 'rotation' | 'break' | 'other';
    exam: boolean;
}

// Builds the announcement list from the course table, using only the structure in the sheet:
// - a practice window is a block labelled "ฝึกปฏิบัติ", or a block that holds exam sub-slots
// - inside a window, each rotation slot warns 10 minutes before its end
// - at the end of a slot the next item decides the audio (change station / break / exam end)
// - a break announces its start, and its end announces returning to practice if training continues
// Registration, briefings and blocks outside the windows produce nothing.
export function buildCprAnnouncements(rows: ImportedRow[], subSlots: SubSlot[], audioFiles: AudioFile[]): CprAnnouncement[] {
    const timed = rows.filter(r => r.status === 'ok' && r.endH !== undefined && r.endM !== undefined);
    const slotParents = new Set(subSlots.map(s => s.parentRowIndex));

    const windows: Window[] = timed
        .filter(r => r.activity.trim().startsWith(PRACTICE_KEYWORD) || slotParents.has(r.rowIndex))
        .map(r => ({
            start: toSeconds(r.h, r.m),
            end: toSeconds(r.endH!, r.endM!),
            exam: slotParents.has(r.rowIndex),
        }));

    const makeItem = (rowIndex: number, start: number, end: number, label: string): Item => {
        const window = windows.find(w => start >= w.start && end <= w.end);
        const kind = label.includes(BREAK_KEYWORD) ? 'break' : window ? 'rotation' : 'other';
        return { rowIndex, start, end, label, kind, exam: Boolean(window?.exam) };
    };

    const items: Item[] = [
        ...timed.map(r => makeItem(r.rowIndex, toSeconds(r.h, r.m), toSeconds(r.endH!, r.endM!), r.activity)),
        ...subSlots.map(s => makeItem(
            s.parentRowIndex,
            toSeconds(s.start.h, s.start.m),
            toSeconds(s.end.h, s.end.m),
            s.text,
        )),
    ];

    const rotations = items.filter(i => i.kind === 'rotation');
    const breaks = items.filter(i => i.kind === 'break');
    const announcements = new Map<string, CprAnnouncement>();

    const add = (at: number, audioName: string, reason: string, rowIndex: number) => {
        const time = fromSeconds(at);
        const key = `${time.h}:${time.m}:${time.s}|${normalize(audioName)}`;
        if (announcements.has(key)) return;
        announcements.set(key, { sourceRowIndex: rowIndex, ...time, ...findAudio(audioFiles, audioName), reason });
    };

    for (const slot of rotations) {
        add(slot.end - ALERT_BEFORE_END, AUDIO.alert, 'เตือนก่อนจบฐาน', slot.rowIndex);

        const startsHere = items.filter(i => i !== slot && i.start === slot.end);
        if (startsHere.some(i => i.kind === 'rotation')) {
            add(slot.end, AUDIO.change, 'หมดเวลาฐาน เปลี่ยนฐาน', slot.rowIndex);
        } else if (slot.exam && !startsHere.some(i => i.kind === 'break')) {
            add(slot.end, AUDIO.examEnd, 'หมดเวลาสอบ', slot.rowIndex);
        }
    }

    for (const brk of breaks) {
        const audio = breakAudio(brk.label);
        add(brk.start, audio.name, audio.reason, brk.rowIndex);
        if (rotations.some(i => i.start >= brk.end)) {
            add(brk.end, AUDIO.resume, 'กลับเข้าฝึก', brk.rowIndex);
        }
    }

    return [...announcements.values()].sort((a, b) => toSeconds(a.h, a.m) - toSeconds(b.h, b.m));
}
