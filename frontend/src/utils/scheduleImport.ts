import * as XLSX from 'xlsx';
import { formatDayKey } from './date';
import { normalizeTime } from './time';

// Header aliases we recognize (Thai + English), matched case-insensitively against
// trimmed cell text. Keep this list narrow — anything not recognized is left unmapped
// rather than guessed.
const HEADER_ALIASES: Record<'date' | 'time' | 'activity' | 'room', string[]> = {
    date: ['วันที่', 'date'],
    time: ['เวลา', 'time'],
    activity: ['กิจกรรม', 'รายการ', 'activity', 'event'],
    room: ['ห้อง', 'สถานที่', 'room', 'location'],
};

export interface ImportedRow {
    rowIndex: number; // 1-based row number in the source file, for user-facing references
    rawDate: string;
    rawTime: string;
    activity: string;
    room: string;
    // Parsed outcome. When status is 'error', h/m/s are not populated and errorReason explains why.
    status: 'ok' | 'error';
    errorReason?: string;
    h: number;
    m: number;
    s: number;
    isToday: boolean;
}

export interface ParsedSchedule {
    rows: ImportedRow[];
    columnsFound: Partial<Record<'date' | 'time' | 'activity' | 'room', string>>;
    missingColumns: Array<'date' | 'time' | 'activity' | 'room'>;
}

function normalizeHeaderCell(cell: unknown): string {
    return String(cell ?? '').trim().toLowerCase();
}

function findColumnIndexes(headerRow: unknown[]): Partial<Record<'date' | 'time' | 'activity' | 'room', number>> {
    const result: Partial<Record<'date' | 'time' | 'activity' | 'room', number>> = {};
    headerRow.forEach((cell, idx) => {
        const normalized = normalizeHeaderCell(cell);
        if (!normalized) return;
        for (const key of Object.keys(HEADER_ALIASES) as Array<keyof typeof HEADER_ALIASES>) {
            if (result[key] !== undefined) continue;
            if (HEADER_ALIASES[key].some(alias => normalized.includes(alias))) {
                result[key] = idx;
            }
        }
    });
    return result;
}

// Parses "8:30", "08:30:00", "8.30", "0830" -> {h,m,s}. Returns null (never guesses) when
// the text doesn't look like a time.
function parseTimeText(raw: string): { h: number; m: number; s: number } | null {
    const text = raw.trim();
    if (!text) return null;

    // 08:30, 8:30:05, 08.30, 08-30
    const sep = text.match(/^(\d{1,2})[:.-](\d{1,2})(?:[:.-](\d{1,2}))?$/);
    if (sep) {
        const h = Number(sep[1]);
        const m = Number(sep[2]);
        const s = sep[3] ? Number(sep[3]) : 0;
        if (h > 23 || m > 59 || s > 59) return null;
        return { h, m, s };
    }

    // Plain 3-4 digit time like "830" or "0830"
    const digits = text.match(/^(\d{3,4})$/);
    if (digits) {
        const padded = digits[1].padStart(4, '0');
        const h = Number(padded.slice(0, 2));
        const m = Number(padded.slice(2, 4));
        if (h > 23 || m > 59) return null;
        return { h, m, s: 0 };
    }

    // Excel sometimes yields a fractional-day number as text when cell formatting is lost.
    const fraction = Number(text);
    if (!Number.isNaN(fraction) && fraction >= 0 && fraction < 1) {
        const totalSeconds = Math.round(fraction * 86400);
        return {
            h: Math.floor(totalSeconds / 3600),
            m: Math.floor((totalSeconds % 3600) / 60),
            s: totalSeconds % 60,
        };
    }

    return null;
}

// Parses "23/10/2026", "23-10-2026", "2026-10-23", and Buddhist-era years (e.g. 2569) by
// converting a 4-digit year > 2400 to Gregorian. Returns a day-key string (YYYY-MM-DD) in
// the *calendar* sense (no timezone conversion) or null if unparseable.
function parseDateText(raw: string): string | null {
    const text = raw.trim();
    if (!text) return null;

    const iso = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (iso) {
        const year = toGregorianYear(Number(iso[1]));
        return buildDayKey(year, Number(iso[2]), Number(iso[3]));
    }

    const dmy = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
    if (dmy) {
        let year = Number(dmy[3]);
        if (year < 100) year += 2000; // 2-digit year shorthand, assumed Gregorian 2000s
        year = toGregorianYear(year);
        return buildDayKey(year, Number(dmy[2]), Number(dmy[1]));
    }

    // Excel date serial number (days since 1899-12-30), sometimes lands as plain text.
    const serial = Number(text);
    if (!Number.isNaN(serial) && serial > 20000 && serial < 80000) {
        const parsed = XLSX.SSF.parse_date_code(serial);
        if (parsed) return buildDayKey(parsed.y, parsed.m, parsed.d);
    }

    return null;
}

function toGregorianYear(year: number): number {
    // Thai Buddhist Era is Gregorian + 543. Any year clearly in that range is converted;
    // anything else is assumed already Gregorian.
    return year > 2400 ? year - 543 : year;
}

function buildDayKey(year: number, month: number, day: number): string | null {
    if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return formatDayKey(date);
}

function cellToDateText(cell: unknown): string {
    // xlsx yields a JS Date for genuinely-formatted date cells.
    if (cell instanceof Date) return formatDayKey(cell);
    return String(cell ?? '');
}

function cellToTimeText(cell: unknown): string {
    if (cell instanceof Date) {
        return `${cell.getHours()}:${cell.getMinutes()}:${cell.getSeconds()}`;
    }
    return String(cell ?? '');
}

export function parseScheduleFile(buffer: ArrayBuffer, fileName: string): ParsedSchedule {
    const isCsv = /\.csv$/i.test(fileName);
    const workbook = isCsv
        ? XLSX.read(new TextDecoder('utf-8').decode(buffer), { type: 'string', raw: false })
        : XLSX.read(buffer, { type: 'array', cellDates: true });

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    // CSV cells are plain text already, so raw:false (keep the original text, e.g. "13.00")
    // is what we want there. For a real workbook, raw:false would instead reformat date/number
    // cells into locale-formatted strings (e.g. "10/23/26"), losing the actual date — so xlsx/xls
    // uses raw:true to keep real Date objects, which cellToDateText/cellToTimeText expect.
    const grid: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: !isCsv, blankrows: false });

    if (grid.length === 0) {
        return { rows: [], columnsFound: {}, missingColumns: ['date', 'time', 'activity', 'room'] };
    }

    const headerRowIdx = 0;
    const headerRow = grid[headerRowIdx];
    const columns = findColumnIndexes(headerRow);
    const missingColumns = (['date', 'time', 'activity', 'room'] as const).filter(k => columns[k] === undefined);
    const columnsFound: ParsedSchedule['columnsFound'] = {};
    for (const key of Object.keys(columns) as Array<keyof typeof columns>) {
        const idx = columns[key];
        if (idx !== undefined) columnsFound[key] = String(headerRow[idx] ?? '').trim();
    }

    const todayKey = formatDayKey(new Date());
    const rows: ImportedRow[] = [];

    for (let i = headerRowIdx + 1; i < grid.length; i++) {
        const line = grid[i];
        if (!line || line.every(cell => String(cell ?? '').trim() === '')) continue;

        const rawDate = columns.date !== undefined ? cellToDateText(line[columns.date]) : '';
        const rawTime = columns.time !== undefined ? cellToTimeText(line[columns.time]) : '';
        const activity = columns.activity !== undefined ? String(line[columns.activity] ?? '').trim() : '';
        const room = columns.room !== undefined ? String(line[columns.room] ?? '').trim() : '';

        const dayKey = parseDateText(rawDate);
        const time = parseTimeText(rawTime);

        let status: ImportedRow['status'] = 'ok';
        let errorReason: string | undefined;

        if (!dayKey) {
            status = 'error';
            errorReason = `อ่านวันที่ไม่ได้: "${rawDate}"`;
        } else if (!time) {
            status = 'error';
            errorReason = `อ่านเวลาไม่ได้: "${rawTime}"`;
        } else if (!activity) {
            status = 'error';
            errorReason = 'ไม่มีชื่อกิจกรรม';
        }

        const normalized = time ? normalizeTime(time.h, time.m, time.s) : { h: 0, m: 0, s: 0 };

        rows.push({
            rowIndex: i + 1,
            rawDate,
            rawTime,
            activity,
            room,
            status,
            errorReason,
            h: normalized.h,
            m: normalized.m,
            s: normalized.s,
            isToday: dayKey === todayKey,
        });
    }

    return { rows, columnsFound, missingColumns };
}

export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}
