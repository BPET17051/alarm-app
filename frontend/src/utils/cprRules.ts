import type { AudioFile } from '../types';
import type { ImportedRow } from './scheduleImport';

export interface CprAnnouncement {
    sourceRowIndex: number;
    h: number;
    m: number;
    s: number;
    audioId: string | null;
    audioDisplayName: string;
    reason: string;
}

const normalize = (value: string) => value.toLowerCase().replace(/[\s._-]+/g, '');
const containsAny = (value: string, words: string[]) => {
    const text = normalize(value);
    return words.some(word => text.includes(normalize(word)));
};
const toSeconds = (h: number, m: number) => h * 3600 + m * 60;
const fromSeconds = (total: number) => {
    const normalized = (total + 86400) % 86400;
    return { h: Math.floor(normalized / 3600), m: Math.floor((normalized % 3600) / 60), s: normalized % 60 };
};

function findAudio(audioFiles: AudioFile[], candidates: string[]) {
    const match = audioFiles.find(file => {
        const name = normalize(`${file.displayName} ${file.fileName}`);
        return candidates.some(candidate => name.includes(normalize(candidate)));
    });
    return match ? { audioId: match.id, audioDisplayName: match.displayName } : { audioId: null, audioDisplayName: '' };
}

function audioForTransition(current: ImportedRow, next: ImportedRow | undefined, audioFiles: AudioFile[]) {
    const currentText = `${current.activity} ${current.room}`;
    const nextText = next ? `${next.activity} ${next.room}` : '';
    const isExam = containsAny(currentText, ['สอบข้อเขียน', 'สอบปฏิบัติ', 'สอบ']) || containsAny(nextText, ['สอบข้อเขียน', 'สอบปฏิบัติ', 'สอบ']);
    const isBreak = containsAny(currentText, ['พัก']) || containsAny(nextText, ['พัก']);
    const returnsToPractice = Boolean(next && containsAny(nextText, ['ฝึก', 'ปฏิบัติ', 'ฐาน']));

    if (!next && isExam) return { reason: 'หมดเวลาสอบ', audio: findAudio(audioFiles, ['หมดเวลาสอบ', 'หมดเวลา']) };
    if (isBreak) return { reason: 'ประกาศช่วงพัก', audio: findAudio(audioFiles, ['พัก', 'เวลาพัก']) };
    if (returnsToPractice) return { reason: 'กลับเข้าฝึก', audio: findAudio(audioFiles, ['กลับเข้าฝึก', 'กลับเข้าฐาน', 'เข้าฝึก']) };
    return { reason: isExam ? 'เตือนก่อนหมดเวลาสอบ' : 'เตือนเปลี่ยนฐาน', audio: findAudio(audioFiles, ['เปลี่ยนฐาน', 'เปลี่ยนสถานี', 'หมดเวลา']) };
}

export function buildCprAnnouncements(rows: ImportedRow[], audioFiles: AudioFile[]): CprAnnouncement[] {
    const validRows = rows
        .filter(row => row.status === 'ok' && row.endH !== undefined && row.endM !== undefined)
        .sort((a, b) => toSeconds(a.h, a.m) - toSeconds(b.h, b.m));

    return validRows.map((row, index) => {
        const time = fromSeconds(toSeconds(row.endH!, row.endM!) - 10 * 60);
        const transition = audioForTransition(row, validRows[index + 1], audioFiles);
        return { sourceRowIndex: row.rowIndex, ...time, ...transition.audio, reason: transition.reason };
    });
}
