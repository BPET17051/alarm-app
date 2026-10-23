import * as XLSX from 'xlsx';
import { formatDayKey } from './date';
import { normalizeTime } from './time';

// Header aliases we recognize (Thai + English), matched case-insensitively against
// trimmed cell text. Used only when the sheet has a real header row; otherwise the
// structure is detected from the cells (see detectStructure below).
const HEADER_ALIASES: Record<'date' | 'time' | 'activity' | 'room', string[]> = {
    date: ['วันที่', 'date'],
    time: ['เวลา', 'time'],
    activity: ['กิจกรรม', 'รายการ', 'activity', 'event'],
    room: ['ห้อง', 'สถานที่', 'room', 'location'],
};

const THAI_MONTHS = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

// How far down the sheet to look for the course date in the title block.
const TITLE_SCAN_ROWS = 15;

export interface ImportedRow {
    rowIndex: number; // 1-based row number in the source sheet
    rawDate: string;
    rawTime: string; // original text, e.g. "08.00 - 08.50 น."
    activity: string;
    room: string;
    // 'error' rows are shown in the preview but can never be selected or saved.
    status: 'ok' | 'error';
    errorReason?: string;
    // Start time (editable default for the announcement).
    h: number;
    m: number;
    s: number;
    // End time, only present when the source gives a range.
    endH?: number;
    endM?: number;
    isToday: boolean;
}

// A time range found in another cell of a main row (e.g. exam sub-slots written across columns).
export interface SubSlot {
    parentRowIndex: number;
    start: { h: number; m: number };
    end: { h: number; m: number };
    text: string;
}

export interface ParsedSchedule {
    rows: ImportedRow[];
    subSlots: SubSlot[];
    sheetName: string;
    courseDate: string | null; // YYYY-MM-DD read from the Thai title, if found
    skippedDetailRows: number; // sub-rows (no time) that were intentionally skipped
    columnsFound: Partial<Record<'date' | 'time' | 'activity' | 'room', string>>;
    missingColumns: Array<'date' | 'time' | 'activity' | 'room'>;
}

function loadWorkbook(buffer: ArrayBuffer, fileName: string): XLSX.WorkBook {
    const isCsv = /\.csv$/i.test(fileName);
    return isCsv
        ? XLSX.read(new TextDecoder('utf-8').decode(buffer), { type: 'string', raw: false })
        : XLSX.read(buffer, { type: 'array', cellDates: true });
}

export function listSheetNames(buffer: ArrayBuffer, fileName: string): string[] {
    return loadWorkbook(buffer, fileName).SheetNames;
}

// Copies the top-left value of every merged range into the cells it covers, so that
// values hidden behind a merge (e.g. a time spanning several rows) are visible to the reader.
function applyMerges(ws: XLSX.WorkSheet) {
    for (const range of ws['!merges'] ?? []) {
        const top = ws[XLSX.utils.encode_cell({ r: range.s.r, c: range.s.c })];
        if (!top) continue;
        for (let r = range.s.r; r <= range.e.r; r++) {
            for (let c = range.s.c; c <= range.e.c; c++) {
                if (r === range.s.r && c === range.s.c) continue;
                ws[XLSX.utils.encode_cell({ r, c })] = { ...top };
            }
        }
    }
}

function cellText(cell: unknown): string {
    if (cell instanceof Date) {
        return `${cell.getHours()}:${cell.getMinutes()}:${cell.getSeconds()}`;
    }
    return String(cell ?? '').trim();
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

// Single time: "8:30", "08.30:05", "0830", or an Excel day fraction. Null when not a time.
function parseTimeText(raw: string): { h: number; m: number; s: number } | null {
    const text = raw.trim();
    if (!text) return null;

    const sep = text.match(/^(\d{1,2})[:.-](\d{1,2})(?:[:.-](\d{1,2}))?$/);
    if (sep) {
        const h = Number(sep[1]);
        const m = Number(sep[2]);
        const s = sep[3] ? Number(sep[3]) : 0;
        if (h > 23 || m > 59 || s > 59) return null;
        return { h, m, s };
    }

    const digits = text.match(/^(\d{3,4})$/);
    if (digits) {
        const padded = digits[1].padStart(4, '0');
        const h = Number(padded.slice(0, 2));
        const m = Number(padded.slice(2, 4));
        if (h > 23 || m > 59) return null;
        return { h, m, s: 0 };
    }

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

// Range like "08.00 - 08.50 น." or "08:00-08:50". Start and end are both validated.
function parseTimeRange(raw: string): { start: { h: number; m: number }; end: { h: number; m: number } } | null {
    const match = raw.trim().match(/^(\d{1,2})[.:](\d{2})\s*(?:น\.?)?\s*[-–]\s*(\d{1,2})[.:](\d{2})/);
    if (!match) return null;
    const start = { h: Number(match[1]), m: Number(match[2]) };
    const end = { h: Number(match[3]), m: Number(match[4]) };
    if (start.h > 23 || start.m > 59 || end.h > 23 || end.m > 59) return null;
    return { start, end };
}

function toGregorianYear(year: number): number {
    // Thai Buddhist Era is Gregorian + 543.
    return year > 2400 ? year - 543 : year;
}

function buildDayKey(year: number, month: number, day: number): string | null {
    if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return formatDayKey(date);
}

// Per-row date cell: "23/10/2026", "2026-10-23", "23-10-2569", or an Excel date serial.
function parseDateText(raw: string): string | null {
    const text = raw.trim();
    if (!text) return null;

    const iso = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (iso) return buildDayKey(toGregorianYear(Number(iso[1])), Number(iso[2]), Number(iso[3]));

    const dmy = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
    if (dmy) {
        let year = Number(dmy[3]);
        if (year < 100) year += 2000;
        return buildDayKey(toGregorianYear(year), Number(dmy[2]), Number(dmy[1]));
    }

    const serial = Number(text);
    if (!Number.isNaN(serial) && serial > 20000 && serial < 80000) {
        const parsed = XLSX.SSF.parse_date_code(serial);
        if (parsed) return buildDayKey(parsed.y, parsed.m, parsed.d);
    }

    return null;
}

// Course date from a Thai title line, e.g. "ในวันจันทร์ ที่ 26 ตุลาคม 2569" (พ.ศ. → ค.ศ.).
export function parseThaiCourseDate(raw: string): string | null {
    const match = raw.match(/ที่\s*(\d{1,2})\s*(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s*(\d{4})/);
    if (!match) return null;
    const month = THAI_MONTHS.indexOf(match[2]) + 1;
    return buildDayKey(toGregorianYear(Number(match[3])), month, Number(match[1]));
}

function findCourseDate(grid: unknown[][]): string | null {
    for (let r = 0; r < Math.min(grid.length, TITLE_SCAN_ROWS); r++) {
        for (const cell of grid[r] ?? []) {
            const found = parseThaiCourseDate(cellText(cell));
            if (found) return found;
        }
    }
    return null;
}

function isNumericText(text: string) {
    return /^[\d.,\s]+$/.test(text);
}

// Picks the time column and the activity column for a sheet without a header row.
// Time = the column (among the first few) holding the most time values.
// Activity = the column just right of it holding the most non-numeric text on the same rows.
function detectStructure(grid: unknown[][]): { timeCol: number; activityCol: number } | null {
    const maxCols = Math.max(0, ...grid.map(row => row.length));
    const timeScanCols = Math.min(maxCols, 5);

    let timeCol = -1;
    let bestTimeCount = 0;
    for (let c = 0; c < timeScanCols; c++) {
        let count = 0;
        for (const row of grid) {
            const text = cellText(row?.[c]);
            if (parseTimeRange(text) || parseTimeText(text)) count++;
        }
        if (count > bestTimeCount) {
            bestTimeCount = count;
            timeCol = c;
        }
    }
    if (timeCol < 0 || bestTimeCount === 0) return null;

    let activityCol = -1;
    let bestActivityCount = 0;
    for (let c = timeCol + 1; c < Math.min(maxCols, timeCol + 5); c++) {
        let count = 0;
        for (const row of grid) {
            const timeText = cellText(row?.[timeCol]);
            const text = cellText(row?.[c]);
            if ((parseTimeRange(timeText) || parseTimeText(timeText)) && text && !isNumericText(text)) count++;
        }
        if (count > bestActivityCount) {
            bestActivityCount = count;
            activityCol = c;
        }
    }
    if (activityCol < 0) return null;

    return { timeCol, activityCol };
}

export function parseScheduleFile(buffer: ArrayBuffer, fileName: string, sheetName?: string): ParsedSchedule {
    const isCsv = /\.csv$/i.test(fileName);
    const workbook = loadWorkbook(buffer, fileName);
    const selectedSheet = sheetName && workbook.SheetNames.includes(sheetName) ? sheetName : workbook.SheetNames[0];
    const sheet = workbook.Sheets[selectedSheet];
    applyMerges(sheet);

    // raw:true keeps real Date objects in xlsx (needed for date/time cells); CSV stays as text.
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: !isCsv, blankrows: true });
    const courseDate = findCourseDate(grid);
    const todayKey = formatDayKey(new Date());

    const headerIdx = grid.slice(0, TITLE_SCAN_ROWS).findIndex(row => {
        const cols = findColumnIndexes(row ?? []);
        return cols.time !== undefined && cols.activity !== undefined;
    });

    const rows: ImportedRow[] = [];
    const subSlots: SubSlot[] = [];
    let skippedDetailRows = 0;

    if (headerIdx >= 0) {
        const headerRow = grid[headerIdx];
        const columns = findColumnIndexes(headerRow);
        const missingColumns = (['date', 'time', 'activity', 'room'] as const).filter(k => columns[k] === undefined);
        const columnsFound: ParsedSchedule['columnsFound'] = {};
        for (const key of Object.keys(columns) as Array<keyof typeof columns>) {
            const idx = columns[key];
            if (idx !== undefined) columnsFound[key] = cellText(headerRow[idx]);
        }

        for (let i = headerIdx + 1; i < grid.length; i++) {
            const line = grid[i] ?? [];
            if (line.every(cell => cellText(cell) === '')) continue;

            const rawDateText = columns.date !== undefined ? cellText(line[columns.date]) : '';
            const rawTime = cellText(line[columns.time!]);
            const activity = cellText(line[columns.activity!]);
            const room = columns.room !== undefined ? cellText(line[columns.room]) : '';
            const dayKey = columns.date !== undefined ? parseDateText(rawDateText) : courseDate;
            const range = parseTimeRange(rawTime);
            const time = range ? { h: range.start.h, m: range.start.m, s: 0 } : parseTimeText(rawTime);
            const normalized = time ? normalizeTime(time.h, time.m, time.s) : { h: 0, m: 0, s: 0 };

            let errorReason: string | undefined;
            if (!dayKey) errorReason = columns.date !== undefined ? `อ่านวันที่ไม่ได้: "${rawDateText}"` : 'ไม่พบวันที่คอร์สในหัวตาราง';
            else if (!time) errorReason = `อ่านเวลาไม่ได้: "${rawTime}"`;
            else if (!activity) errorReason = 'ไม่มีชื่อกิจกรรม';

            rows.push({
                rowIndex: i + 1,
                rawDate: rawDateText || courseDate || '',
                rawTime,
                activity,
                room,
                status: errorReason ? 'error' : 'ok',
                errorReason,
                h: normalized.h,
                m: normalized.m,
                s: normalized.s,
                endH: range?.end.h,
                endM: range?.end.m,
                isToday: dayKey === todayKey,
            });
        }

        return {
            rows,
            sheetName: selectedSheet,
            courseDate,
            skippedDetailRows,
            subSlots,
            columnsFound,
            missingColumns,
        };
    }

    // No header row: the course table layout (time range in one column, activity in the next).
    const structure = detectStructure(grid);
    if (!structure) {
        return {
            rows: [],
            sheetName: selectedSheet,
            courseDate,
            skippedDetailRows,
            subSlots,
            columnsFound: {},
            missingColumns: ['date', 'time', 'activity', 'room'],
        };
    }

    // Time ranges that sit in other cells of a main row (e.g. exam sub-slots written across columns).
    const SUB_RANGE = /(\d{1,2})[.:](\d{2})\s*[-–]\s*(\d{1,2})[.:](\d{2})/;
    const seenSubSlots = new Set<string>();
    for (let i = 0; i < grid.length; i++) {
        const line = grid[i] ?? [];
        if (!parseTimeRange(cellText(line[structure.timeCol]))) continue;
        line.forEach((cell, c) => {
            if (c === structure.timeCol || c === structure.activityCol) return;
            const text = cellText(cell);
            const match = text.match(SUB_RANGE);
            if (!match) return;
            const key = `${i + 1}|${text}`;
            if (seenSubSlots.has(key)) return;
            seenSubSlots.add(key);
            subSlots.push({
                parentRowIndex: i + 1,
                start: { h: Number(match[1]), m: Number(match[2]) },
                end: { h: Number(match[3]), m: Number(match[4]) },
                text,
            });
        });
    }

    for (let i = 0; i < grid.length; i++) {
        const line = grid[i] ?? [];
        const rawTime = cellText(line[structure.timeCol]);
        // Rotation rows often keep their group name in a later column (e.g. "กลุ่ม 1" in column D),
        // so fall back to the first text cell in the row when the activity column is empty.
        const fallbackText = line
            .map((cell, c) => ({ c, text: cellText(cell) }))
            .find(({ c, text }) => c !== structure.timeCol && text !== '' && !isNumericText(text) && !parseTimeRange(text))?.text ?? '';
        const activity = cellText(line[structure.activityCol]) || fallbackText;

        // Only a time range or single time marks a main announcement row. Anything else in the
        // time column (notes like "หมายเหตุ :", sub-slots) and rows without an activity are
        // detail rows and are skipped, not reported as errors.
        const range = parseTimeRange(rawTime);
        const single = range ? null : parseTimeText(rawTime);
        if (!range && !single) {
            if (rawTime || activity) skippedDetailRows++;
            continue;
        }
        if (!activity) {
            skippedDetailRows++;
            continue;
        }

        const start = range ? { h: range.start.h, m: range.start.m, s: 0 } : single!;
        const normalized = normalizeTime(start.h, start.m, start.s);

        rows.push({
            rowIndex: i + 1,
            rawDate: courseDate ?? '',
            rawTime,
            activity,
            room: '',
            status: courseDate ? 'ok' : 'error',
            errorReason: courseDate ? undefined : 'ไม่พบวันที่คอร์สในหัวตาราง',
            h: normalized.h,
            m: normalized.m,
            s: normalized.s,
            endH: range?.end.h,
            endM: range?.end.m,
            isToday: courseDate === todayKey,
        });
    }

    return {
        rows,
        subSlots,
        sheetName: selectedSheet,
        courseDate,
        skippedDetailRows,
        columnsFound: {
            time: `คอลัมน์ ${XLSX.utils.encode_col(structure.timeCol)}`,
            activity: `คอลัมน์ ${XLSX.utils.encode_col(structure.activityCol)}`,
        },
        missingColumns: [],
    };
}

export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}
