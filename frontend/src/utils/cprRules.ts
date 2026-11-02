import type { AudioFile } from '../types';
import type { ImportedRow, SubSlot } from './scheduleImport';

export type CprCategory = 'alert' | 'change' | 'break' | 'resume' | 'examEnd';

export const CPR_CATEGORY_LABELS: Record<CprCategory, string> = {
    alert: 'เตือนก่อนจบฐาน',
    change: 'เปลี่ยนฐาน',
    break: 'พัก',
    resume: 'กลับเข้าฝึก',
    examEnd: 'หมดเวลาสอบ',
};

export interface CprAnnouncement {
    // Draft spoken text, one group per line ("กลุ่ม 1, เข้า Station 2"), built only from what the sheet shows.
    // Empty when it cannot be built; `ttsNote` then tells the staff why they must type it themselves.
    ttsDraft: string;
    ttsNote?: string;
    sourceRowIndex: number;
    category: CprCategory;
    // Where it comes from in the sheet: the practice block, the slot's time range and its Excel row.
    source: string;
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
const BREAK_KEYWORDS = ['พัก', 'รับประทานอาหาร'];
// A row that only names a group ("กลุ่ม 1", "กลุ่ม 4 - 6") is a rotation slot even without a practice block above it.
const GROUP_LABEL = /^กลุ่ม\s*\d/;
const mentionsPractice = (label: string) => label.includes(PRACTICE_KEYWORD);

const normalize = (value: string) => value.toLowerCase().replace(/[\s._-]+/g, '');
const toSeconds = (h: number, m: number) => h * 3600 + m * 60;
const fromSeconds = (total: number) => {
    const normalized = ((total % 86400) + 86400) % 86400;
    return { h: Math.floor(normalized / 3600), m: Math.floor((normalized % 3600) / 60), s: normalized % 60 };
};

// Only for comparing audio names: ฎ and ฏ are the same letter here, because the library spells one sound
// "ปฎิบัติ" while it is written "ปฏิบัติ" elsewhere. The file name and id are never changed, and no other
// letters are folded, so names with a different meaning still do not match.
const foldAudioName = (value: string) => normalize(value).replace(/ฎ/g, 'ฏ');

// The library entry whose name equals `name` (after the folding above), or null. Exported so the preview
// can match again when the library finishes loading after the announcements were built.
export function findAudioByName(audioFiles: AudioFile[], name: string): AudioFile | null {
    const target = foldAudioName(name);
    return audioFiles.find(file => foldAudioName(file.displayName) === target) ?? null;
}

function findAudio(audioFiles: AudioFile[], name: string) {
    const match = findAudioByName(audioFiles, name);
    return match
        ? { audioId: match.id, audioDisplayName: match.displayName }
        : { audioId: null, audioDisplayName: name };
}

function breakAudio(label: string) {
    if (label.includes('กลางวัน')) return { name: AUDIO.lunchBreak, reason: 'ประกาศพักกลางวัน' };
    if (/15\s*นาที/.test(label)) return { name: AUDIO.shortBreak, reason: 'ประกาศพัก 15 นาที' };
    return { name: AUDIO.snackBreak, reason: 'ประกาศพักว่าง' };
}

interface Window { start: number; end: number; exam: boolean; label: string }

interface Item {
    rowIndex: number;
    start: number;
    end: number;
    label: string;
    windowLabel: string;
    context: string;
    timeText: string;
    kind: 'rotation' | 'break' | 'other';
    exam: boolean;
}

// Draft for the slot that starts at `at`: which group goes to which station, read from the sheet's own cells.
// Nothing is invented: if the slot lists no groups, or a group has no station label above it, no text is made.
function groupsDraft(at: number, items: Item[], rows: ImportedRow[]): { text: string; note?: string } {
    const starters = items
        .filter(i => i.kind === 'rotation' && i.start === at)
        .sort((a, b) => (a.end - a.start) - (b.end - b.start));
    const row = starters
        .map(i => rows.find(r => r.rowIndex === i.rowIndex))
        .find(r => r?.groups && r.groups.length > 0);
    if (!row?.groups) {
        return { text: '', note: 'ตารางไม่ระบุกลุ่ม/ห้องของช่วงถัดไป — พิมพ์ข้อความ TTS เองถ้าต้องการ' };
    }
    // Two different labels for one column (e.g. "Station 3" and "S2"): the sheet contradicts itself, so no
    // label is chosen and no text is made.
    const conflicting = row.groups.filter(g => g.stationConflict && g.stationConflict.length > 1);
    if (conflicting.length > 0) {
        const detail = conflicting.map(g => `${g.group}: ${g.stationConflict!.join(' กับ ')}`).join('; ');
        return { text: '', note: `ป้าย Station ในตารางขัดแย้งกัน (${detail}) — ตรวจตารางแล้วพิมพ์ข้อความ TTS เอง` };
    }
    const missing = row.groups.filter(g => !g.station);
    if (missing.length > 0) {
        return { text: '', note: `ไม่พบป้าย Station/ห้องของ ${missing.map(g => g.group).join(', ')} ในตาราง — พิมพ์ข้อความ TTS เอง` };
    }
    return { text: row.groups.map(g => `${g.group}, เข้า ${g.station}`).join('\n') };
}

// Builds the announcement list from the course table, using only the structure in the sheet:
// - a practice window is a block labelled "ฝึกปฏิบัติ", or a block that holds exam sub-slots
// - inside a window, each rotation slot warns 10 minutes before its end
// - at the end of a slot the next item decides the audio (change station / break / exam end)
// - a break announces its start, and its end announces returning to practice if training continues
// Registration, briefings and blocks outside the windows produce nothing.
function analyze(rows: ImportedRow[], subSlots: SubSlot[], audioFiles: AudioFile[]): { announcements: CprAnnouncement[]; notes: string[] } {
    const timed = rows.filter(r => r.status === 'ok' && r.endH !== undefined && r.endM !== undefined);
    const slotParents = new Set(subSlots.map(s => s.parentRowIndex));

    // A block that is split into smaller timed rows below it (not counting breaks) is a training block even
    // when its title has no keyword, e.g. an exam block listing its own rounds as separate time rows.
    const isBreakText = (text: string) => BREAK_KEYWORDS.some(word => text.includes(word));
    const splitsIntoRows = (r: ImportedRow) => {
        const start = toSeconds(r.h, r.m);
        const end = toSeconds(r.endH!, r.endM!);
        return timed.filter(c => c !== r && !isBreakText(c.activity)
            && toSeconds(c.h, c.m) >= start && toSeconds(c.endH!, c.endM!) <= end
            && toSeconds(c.endH!, c.endM!) - toSeconds(c.h, c.m) < end - start).length >= 2;
    };
    const EXAM_WORDS = /สอบ|exam|test/i;
    // A block with several child rows is only treated as a station/exam block when its own title says so.
    // Without such a word (e.g. a lecture split into parts) nothing is announced from it.
    const TRAINING_CONTEXT = /ฝึกปฏิบัติ|สถานี|station|สอบ|exam|test/i;

    const windows: Window[] = timed
        .filter(r => r.activity.trim().startsWith(PRACTICE_KEYWORD) || slotParents.has(r.rowIndex)
            || (splitsIntoRows(r) && TRAINING_CONTEXT.test(r.activity)))
        .map(r => ({
            start: toSeconds(r.h, r.m),
            end: toSeconds(r.endH!, r.endM!),
            exam: slotParents.has(r.rowIndex) || EXAM_WORDS.test(r.activity),
            label: r.activity.trim(),
        }));

    // A row whose time is only a merged copy of another row's time, where that other row is a titled block
    // (not itself a group row), is a note under that block (e.g. the groups listed under one Megacode
    // block), not a training round of its own. This follows the merge, not equal times.
    const isAnnotation = (r: ImportedRow) => {
        if (r.mergedFromRow === undefined) return false;
        const parent = rows.find(p => p.rowIndex === r.mergedFromRow);
        return Boolean(parent && !GROUP_LABEL.test(parent.activity.trim()));
    };
    const annotationRows = new Set(timed.filter(isAnnotation).map(r => r.rowIndex));

    const makeItem = (rowIndex: number, start: number, end: number, label: string, timeText: string, context: string, fromSubSlot = false): Item => {
        const window = windows.find(w => start >= w.start && end <= w.end);
        const isBreak = BREAK_KEYWORDS.some(word => label.includes(word));
        const groupSlot = GROUP_LABEL.test(label.trim()) && (fromSubSlot || !annotationRows.has(rowIndex));
        const kind = isBreak ? 'break' : window || groupSlot ? 'rotation' : 'other';
        return { rowIndex, start, end, label, windowLabel: window?.label ?? '', context, timeText, kind, exam: Boolean(window?.exam) };
    };

    const items: Item[] = [
        ...timed.map(r => makeItem(r.rowIndex, toSeconds(r.h, r.m), toSeconds(r.endH!, r.endM!), r.activity, r.rawTime, r.context ?? '')),
        ...subSlots.map(s => makeItem(
            s.parentRowIndex,
            toSeconds(s.start.h, s.start.m),
            toSeconds(s.end.h, s.end.m),
            s.text,
            s.text,
            rows.find(r => r.rowIndex === s.parentRowIndex)?.context ?? '',
            true,
        )),
    ];

    // Shortest slots first, so when a slot and the block that contains it give the same announcement,
    // the more specific slot is the one reported as the source.
    const rotations = items
        .filter(i => i.kind === 'rotation')
        .sort((a, b) => (a.end - a.start) - (b.end - b.start));
    const breaks = items.filter(i => i.kind === 'break');
    const announcements = new Map<string, CprAnnouncement>();
    const endNotes = new Map<number, string>(); // keyed by the end time so one note is given per time

    // "<practice block> · <slot range> · แถว N" so each announcement can be checked against the Excel row.
    const describe = (item: Item) => {
        const clean = (text: string) => text.replace(/\s+/g, ' ').trim();
        const what = item.windowLabel || [clean(item.context), clean(item.label)].filter(Boolean).join(' › ');
        return `${what} · ${clean(item.timeText)} · แถว ${item.rowIndex}`;
    };

    const add = (at: number, category: CprCategory, audioName: string, reason: string, item: Item) => {
        const time = fromSeconds(at);
        const key = `${time.h}:${time.m}:${time.s}|${normalize(audioName)}`;
        if (announcements.has(key)) return;
        // Only announcements that send groups to a new station get a draft; alerts, breaks and exam end never do.
        const draft = category === 'change' || category === 'resume' ? groupsDraft(at, items, rows) : { text: '' };
        announcements.set(key, {
            ttsDraft: draft.text,
            ttsNote: draft.note,
            sourceRowIndex: item.rowIndex,
            category,
            source: describe(item),
            ...time,
            ...findAudio(audioFiles, audioName),
            reason,
        });
    };

    for (const slot of rotations) {
        add(slot.end - ALERT_BEFORE_END, 'alert', AUDIO.alert, 'เตือนก่อนจบฐาน', slot);

        const startsHere = items.filter(i => i !== slot && i.start === slot.end);
        if (startsHere.some(i => i.kind === 'rotation')) {
            add(slot.end, 'change', AUDIO.change, 'หมดเวลาฐาน เปลี่ยนฐาน', slot);
        } else if (slot.exam && !startsHere.some(i => i.kind === 'break')) {
            add(slot.end, 'examEnd', AUDIO.examEnd, 'หมดเวลาสอบ', slot);
        } else if (!slot.exam && !startsHere.some(i => i.kind === 'break') && !endNotes.has(slot.end)) {
            // The slot ends with nothing announced: no next station, no break, not an exam. There is no rule
            // and no general "end of activity" sound is assumed, so staff decide. (Never reuse the exam sound.)
            const t = fromSeconds(slot.end);
            endNotes.set(slot.end, `จบ ${String(t.h).padStart(2, '0')}:${String(t.m).padStart(2, '0')} (${describe(slot)}) ยังไม่มีประกาศสิ้นสุด — เจ้าหน้าที่ตัดสินใจว่าจะเพิ่มเองหรือไม่`);
        }
    }

    for (const brk of breaks) {
        const audio = breakAudio(brk.label);
        add(brk.start, 'break', audio.name, audio.reason, brk);
        // "Back to training" is announced when the break ends only if practice really starts then: a rotation
        // slot begins, or a row starting at that time is about practising (e.g. "เตรียมฝึกปฏิบัติ"). A break
        // followed only by a briefing gets no such announcement.
        const startsAtBreakEnd = items.filter(i => i !== brk && i.start === brk.end);
        const practiceStartsNow = startsAtBreakEnd.some(i => i.kind === 'rotation' || mentionsPractice(i.label));
        if (practiceStartsNow && rotations.some(i => i.start >= brk.end)) {
            add(brk.end, 'resume', AUDIO.resume, 'กลับเข้าฝึก', brk);
        }
    }

    return {
        announcements: [...announcements.values()].sort((a, b) => toSeconds(a.h, a.m) - toSeconds(b.h, b.m)),
        notes: [...endNotes.entries()].sort((a, b) => a[0] - b[0]).map(([, note]) => note),
    };
}

export function buildCprAnnouncements(rows: ImportedRow[], subSlots: SubSlot[], audioFiles: AudioFile[]): CprAnnouncement[] {
    return analyze(rows, subSlots, audioFiles).announcements;
}

// Observations for the staff, e.g. a training slot that ends with no announcement. Not errors.
export function buildCprNotes(rows: ImportedRow[], subSlots: SubSlot[]): string[] {
    return analyze(rows, subSlots, []).notes;
}
