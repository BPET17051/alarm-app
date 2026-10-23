import { useEffect, useMemo, useRef, useState } from 'react';
import { useAlarms } from '../hooks/useAlarms';
import * as API from '../services/api';
import type { AudioFile } from '../types';
import { listSheetNames, parseScheduleFile, readFileAsArrayBuffer, type ImportedRow } from '../utils/scheduleImport';
import { sanitizeAudioDisplayName } from '../utils/audio';
import { formatDayKey } from '../utils/date';
import { buildCprAnnouncements, CPR_CATEGORY_LABELS, type CprCategory } from '../utils/cprRules';

interface ImportScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface RowState extends ImportedRow {
    key: number;
    selected: boolean;
    audioId: string | null;
    audioDisplayName: string;
    ttsText: string;
    // Only for generated CPR announcements: what kind it is and where it comes from in the sheet.
    category?: CprCategory;
    source?: string;
    // Set once a save attempt has run for this row. 'saved' rows are locked (can't be
    // re-imported by re-selecting them); 'failed' rows stay editable so the user can retry.
    saveStatus?: 'saved' | 'failed';
    saveError?: string;
}

type Stage = 'pick' | 'preview' | 'saving';

function timeKey(r: { h: number; m: number; s: number }) {
    return r.h * 3600 + r.m * 60 + r.s;
}

function formatHm(h: number, m: number) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const THAI_MONTHS: Array<[string, string]> = [
    ['มกราคม', 'ม.ค.'], ['กุมภาพันธ์', 'ก.พ.'], ['มีนาคม', 'มี.ค.'], ['เมษายน', 'เม.ย.'],
    ['พฤษภาคม', 'พ.ค.'], ['มิถุนายน', 'มิ.ย.'], ['กรกฎาคม', 'ก.ค.'], ['สิงหาคม', 'ส.ค.'],
    ['กันยายน', 'ก.ย.'], ['ตุลาคม', 'ต.ค.'], ['พฤศจิกายน', 'พ.ย.'], ['ธันวาคม', 'ธ.ค.'],
];

// Reads a course date written in the file name, e.g. "(26 ต.ค. 2569)" or "26 ตุลาคม 2569" (พ.ศ. → ค.ศ.).
// Returns null when the name has no date, so the caller never has to guess.
function dateFromFileName(name: string): string | null {
    for (let i = 0; i < THAI_MONTHS.length; i++) {
        for (const month of THAI_MONTHS[i]) {
            const escaped = month.replace(/\./g, '\\.');
            const match = name.match(new RegExp(`(\\d{1,2})\\s*${escaped}\\s*(\\d{4})`));
            if (!match) continue;
            const year = Number(match[2]) > 2400 ? Number(match[2]) - 543 : Number(match[2]);
            const date = new Date(year, i, Number(match[1]));
            if (date.getFullYear() === year && date.getMonth() === i && date.getDate() === Number(match[1])) {
                return formatDayKey(date);
            }
        }
    }
    return null;
}

export function ImportScheduleModal({ isOpen, onClose }: ImportScheduleModalProps) {
    const { items, importItems, saveTemplateItems } = useAlarms();
    const [templateName, setTemplateName] = useState('');
    const [templateSaved, setTemplateSaved] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [stage, setStage] = useState<Stage>('pick');
    const [fileName, setFileName] = useState('');
    const [fileError, setFileError] = useState<string | null>(null);
    const [missingColumns, setMissingColumns] = useState<string[]>([]);
    const [rows, setRows] = useState<RowState[]>([]);
    const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
    const [summary, setSummary] = useState<{ succeeded: number; failed: number; leaseLost: boolean } | null>(null);
    const [sheetNames, setSheetNames] = useState<string[]>([]);
    const [sheetName, setSheetName] = useState('');
    const [courseDate, setCourseDate] = useState<string | null>(null);
    const [skippedCount, setSkippedCount] = useState(0);
    // Rows whose TTS text box is open (the box is hidden behind a button to keep the list short).
    const [ttsOpen, setTtsOpen] = useState<Set<number>>(new Set());
    const [sheetPrompt, setSheetPrompt] = useState<string | null>(null);
    // Kept so changing the worksheet re-parses the same file without asking the user to re-pick it.
    const fileBufferRef = useRef<ArrayBuffer | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting a modal's local state on open, same pattern as AudioSelectionModal
        setStage('pick');
        setFileName('');
        setFileError(null);
        setMissingColumns([]);
        setRows([]);
        setSummary(null);
        setSheetNames([]);
        setSheetName('');
        setCourseDate(null);
        setSkippedCount(0);
        setTtsOpen(new Set());
        setSheetPrompt(null);
        fileBufferRef.current = null;
        API.getAudioFiles().then(setAudioFiles).catch(() => setAudioFiles([]));
    }, [isOpen]);

    // Alarms already in the channel (loaded from the backend), refreshed after every
    // successful importItems() call — so a duplicate re-upload of the same file is caught here.
    const existingTimeKeys = useMemo(() => new Set(items.map(timeKey)), [items]);

    // Duplicate/collision detection recomputed whenever the selection or a row's time changes.
    // This is a hard block (see hasBlockingWarnings below), not just a hint, to satisfy
    // "prevent duplicate import": a selected row can never be saved while it collides.
    const rowWarnings = useMemo(() => {
        const warnings = new Map<number, string>();
        const selectedByTimeKey = new Map<number, number[]>();

        rows.forEach(r => {
            if (!r.selected || r.status !== 'ok' || r.saveStatus === 'saved') return;
            const k = timeKey(r);
            const list = selectedByTimeKey.get(k) ?? [];
            list.push(r.key);
            selectedByTimeKey.set(k, list);
        });

        rows.forEach(r => {
            if (!r.selected || r.status !== 'ok' || r.saveStatus === 'saved') return;
            const k = timeKey(r);
            // Only today's rows can collide with the Scheduler; other days are checked against the file alone.
            if (r.isToday && existingTimeKeys.has(k)) {
                warnings.set(r.key, 'เวลานี้มีรายการอยู่แล้วในตารางวันนี้ (ซ้ำ)');
            } else if ((selectedByTimeKey.get(k)?.length ?? 0) > 1) {
                warnings.set(r.key, 'เวลาชนกับอีกรายการที่เลือกไว้ในไฟล์นี้');
            }
        });

        return warnings;
    }, [rows, existingTimeKeys]);

    // Parses one worksheet of the loaded file. Nothing is pre-selected: the user picks the
    // activities to announce and sets their times, so a wrong sheet or date can't be saved by accident.
    const loadSheet = (buffer: ArrayBuffer, name: string, sheet: string) => {
        const parsed = parseScheduleFile(buffer, name, sheet);
        if (parsed.rows.length === 0) {
            setFileError('ไม่พบรายการกิจกรรมในชีตนี้ (ตรวจสอบว่าเลือกชีตที่เป็นตารางอบรม)');
            setRows([]);
            setStage('pick');
            return;
        }
        setFileError(null);
        setSheetPrompt(null);
        setTtsOpen(new Set());
        setSheetName(parsed.sheetName);
        setCourseDate(parsed.courseDate);
        setSkippedCount(parsed.skippedDetailRows);
        setMissingColumns(parsed.missingColumns);
        setSummary(null);
        const isToday = parsed.courseDate === formatDayKey(new Date());
        const announcements = buildCprAnnouncements(parsed.rows, parsed.subSlots, audioFiles);
        if (announcements.length > 0) {
            // CPR course: the preview lists the generated announcements, pre-selected, to review and edit.
            setRows(announcements.map((a, idx) => ({
                rowIndex: a.sourceRowIndex,
                rawDate: parsed.courseDate ?? '',
                rawTime: formatHm(a.h, a.m),
                activity: a.reason,
                category: a.category,
                source: a.source,
                room: '',
                status: 'ok' as const,
                h: a.h,
                m: a.m,
                s: a.s,
                isToday,
                key: idx,
                selected: true,
                audioId: a.audioId,
                audioDisplayName: a.audioDisplayName,
                ttsText: '',
            })));
        } else {
            setRows(parsed.rows.map((r, idx) => ({
                ...r,
                key: idx,
                selected: false,
                audioId: null,
                audioDisplayName: '',
                ttsText: '',
            })));
        }
        setStage('preview');
    };

    const handleFile = async (file: File) => {
        setFileError(null);
        setFileName(file.name);
        if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
            setFileError('รองรับเฉพาะไฟล์ .xlsx หรือ .csv เท่านั้น');
            return;
        }
        try {
            const buffer = await readFileAsArrayBuffer(file);
            fileBufferRef.current = buffer;
            const names = listSheetNames(buffer, file.name);
            setSheetNames(names);

            // Pick the worksheet automatically only when it is unambiguous: a single sheet, or exactly one
            // sheet whose course date equals the date written in the file name. Otherwise the user chooses.
            let chosen = names.length === 1 ? names[0] : null;
            const fileDate = dateFromFileName(file.name);
            if (!chosen && fileDate) {
                const matches = names.filter(n => parseScheduleFile(buffer, file.name, n).courseDate === fileDate);
                if (matches.length === 1) chosen = matches[0];
            }
            if (chosen) {
                loadSheet(buffer, file.name, chosen);
            } else {
                setSheetName('');
                setCourseDate(null);
                setRows([]);
                setSummary(null);
                setSheetPrompt(fileDate
                    ? `ชื่อไฟล์ระบุวันที่ ${fileDate} แต่ไม่มีชีตเดียวที่ตรงกัน กรุณาเลือกชีตเอง`
                    : 'ไฟล์นี้มีหลายชีตและชื่อไฟล์ไม่ระบุวันที่ กรุณาเลือกชีตที่ตรงกับคอร์ส');
                setStage('preview');
            }
        } catch (e) {
            console.error('Failed to parse schedule file', e);
            setFileError('อ่านไฟล์ไม่สำเร็จ ตรวจสอบว่าไฟล์ไม่เสียหายและเป็นรูปแบบ .xlsx หรือ .csv');
        }
    };

    const updateRow = (key: number, patch: Partial<RowState>) => {
        setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
    };

    const selectableRows = rows.filter(r => r.status === 'ok' && r.saveStatus !== 'saved');
    const pendingSelected = rows.filter(r => r.selected && r.saveStatus !== 'saved');
    const selectedCount = pendingSelected.length;
    const hasBlockingWarnings = rowWarnings.size > 0;
    // The Scheduler only shows today's alarms, so the course must be today before anything is added to it.
    const isCourseToday = courseDate !== null && courseDate === formatDayKey(new Date());
    const templateItems = rows.filter(r => r.selected).map(r => ({
        h: r.h,
        m: r.m,
        s: r.s,
        audioId: r.audioId,
        audioDisplayName: r.audioDisplayName || r.activity,
        ttsText: r.ttsText.trim() || null,
    }));
    // Count of the selected generated announcements per type, in a fixed order.
    const categoryCounts = (Object.keys(CPR_CATEGORY_LABELS) as CprCategory[])
        .map(category => [category, rows.filter(r => r.category === category && r.selected).length] as [CprCategory, number])
        .filter(([, count]) => count > 0);
    const canSaveTemplate = templateItems.length > 0 && templateName.trim() !== '' && stage === 'preview';

    // Saves the selected rows as a template only. It never touches the channel's alarms.
    const handleSaveTemplate = async () => {
        if (!canSaveTemplate) return;
        const name = templateName.trim();
        try {
            await saveTemplateItems(name, templateItems);
            setTemplateSaved(`บันทึก Template "${name}" แล้ว (${templateItems.length} รายการ)`);
            setTemplateName('');
        } catch (e) {
            console.error('Failed to save template', e);
            setTemplateSaved(null);
            setFileError('บันทึก Template ไม่สำเร็จ ลองใหม่อีกครั้ง');
        }
    };

    const handleSave = async () => {
        const toSave = pendingSelected;
        if (toSave.length === 0 || hasBlockingWarnings || !isCourseToday) return;
        setStage('saving');
        const outcome = await importItems(toSave.map(r => ({
            h: r.h,
            m: r.m,
            s: r.s,
            audioId: r.audioId,
            audioDisplayName: r.audioDisplayName || r.activity,
            ttsText: r.ttsText.trim() || null,
        })));

        const failedIndexes = new Set(outcome.failed.map(f => f.index));
        const failedMessages = new Map(outcome.failed.map(f => [f.index, f.message]));
        setRows(prev => prev.map(r => {
            const idx = toSave.findIndex(t => t.key === r.key);
            if (idx === -1) return r;
            return failedIndexes.has(idx)
                ? { ...r, saveStatus: 'failed', saveError: failedMessages.get(idx) }
                : { ...r, saveStatus: 'saved', selected: false };
        }));

        setSummary({ succeeded: outcome.succeeded, failed: outcome.failed.length, leaseLost: outcome.leaseLost });
        setStage('preview');
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={stage === 'saving' ? undefined : onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-modal-title"
        >
            <div
                className="bg-card border border-line rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl animate-scale-in"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-6 border-b border-line/50">
                    <h2 id="import-modal-title" className="text-xl font-bold">นำเข้าตารางประกาศ</h2>
                    {stage !== 'saving' && (
                        <button onClick={onClose} className="text-muted hover:text-fg transition-colors" aria-label="ปิด">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-6">
                    {stage === 'pick' && (
                        <div className="space-y-4">
                            <p className="text-sm text-muted">
                                อัปโหลดไฟล์ .xlsx หรือ .csv ที่มีคอลัมน์ <strong>วันที่, เวลา, กิจกรรม, ห้อง</strong> (ชื่อคอลัมน์ภาษาอังกฤษ date/time/activity/room ก็ใช้ได้)
                            </p>
                            <p className="text-xs text-muted/70">
                                ดูตัวอย่างและบันทึกเป็น Template ได้ทุกวันที่ แต่เพิ่มเข้าตารางประกาศได้เฉพาะคอร์สของ "วันนี้"
                            </p>
                            <div
                                className="border-2 border-dashed border-line rounded-xl p-10 text-center hover:bg-bg-soft/30 transition-colors cursor-pointer"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={e => {
                                        const file = e.target.files?.[0];
                                        if (file) void handleFile(file);
                                    }}
                                />
                                <div className="text-muted flex flex-col items-center gap-2">
                                    <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                    <span>กดเพื่อเลือกไฟล์ตารางคอร์ส</span>
                                </div>
                            </div>
                            {fileError && (
                                <p className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg p-3">{fileError}</p>
                            )}
                        </div>
                    )}

                    {(stage === 'preview' || stage === 'saving') && (
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                <span className="text-muted">ไฟล์: <strong className="text-fg">{fileName}</strong> · พบ {rows.length} รายการ · เลือกแล้ว {selectedCount} รายการ</span>
                                <button
                                    type="button"
                                    onClick={() => { setStage('pick'); setRows([]); setSummary(null); }}
                                    disabled={stage === 'saving'}
                                    className="text-primary hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    เลือกไฟล์อื่น
                                </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-sm">
                                {sheetNames.length > 1 && (
                                    <label className="flex items-center gap-2 text-muted">
                                        ชีต
                                        <select
                                            value={sheetName}
                                            disabled={stage === 'saving'}
                                            onChange={e => e.target.value && fileBufferRef.current && loadSheet(fileBufferRef.current, fileName, e.target.value)}
                                            className="bg-bg-soft border border-line rounded px-2 py-1 text-fg"
                                            aria-label="เลือกชีต"
                                        >
                                            {sheetName === '' && <option value="">— เลือกชีต —</option>}
                                            {sheetNames.map(name => (
                                                <option key={name} value={name}>{name}</option>
                                            ))}
                                        </select>
                                    </label>
                                )}
                                <span className="text-muted">
                                    วันคอร์ส: <strong className="text-fg">{courseDate ?? 'ไม่พบ (อ่านจากหัวตารางไม่ได้)'}</strong>
                                </span>
                                {skippedCount > 0 && (
                                    <span className="text-muted/70">ข้ามแถวรายละเอียด {skippedCount} แถว</span>
                                )}
                            </div>

                            {missingColumns.length > 0 && (
                                <p className="text-sm text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                                    ไม่พบคอลัมน์: {missingColumns.join(', ')} — แถวที่ขาดข้อมูลจะถูกทำเครื่องหมายว่าอ่านไม่ได้
                                </p>
                            )}

                            {sheetPrompt && (
                                <p className="text-sm text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">{sheetPrompt}</p>
                            )}

                            {categoryCounts.length > 0 && (
                                <div className="flex flex-wrap gap-2 text-xs" aria-label="สรุปตามประเภทประกาศ">
                                    {categoryCounts.map(([category, count]) => (
                                        <span key={category} className="px-2 py-1 rounded-md bg-bg-soft border border-line text-muted">
                                            {CPR_CATEGORY_LABELS[category]} <strong className="text-fg">{count}</strong>
                                        </span>
                                    ))}
                                </div>
                            )}

                            {summary && (
                                <div className={`text-sm rounded-lg p-3 border ${summary.failed === 0
                                    ? 'bg-green-500/10 border-green-500/30 text-green-500'
                                    : summary.succeeded === 0
                                        ? 'bg-danger/10 border-danger/30 text-danger'
                                        : 'bg-amber-500/10 border-amber-500/30 text-amber-500'}`}
                                >
                                    <p className="font-bold">
                                        {summary.failed === 0 ? '✅ บันทึกสำเร็จทั้งหมด' : summary.succeeded === 0 ? '❌ บันทึกไม่สำเร็จ' : '⚠️ บันทึกสำเร็จบางส่วน'}
                                    </p>
                                    <p>สำเร็จ {summary.succeeded} รายการ{summary.failed > 0 ? ` · ล้มเหลว ${summary.failed} รายการ (ดูรายละเอียดในตารางด้านล่าง ลองใหม่ได้)` : ''}</p>
                                    {summary.leaseLost && <p>สิทธิ์ใช้ช่องนี้หลุดระหว่างนำเข้า อาจมีรายการที่ยังไม่ถูกบันทึก กรุณาเข้าช่องใหม่แล้วลองอีกครั้ง</p>}
                                    <p className="text-xs opacity-80 mt-1">รายการที่บันทึกไปแล้วจะไม่ถูกย้อนกลับ แม้ส่วนที่เหลือล้มเหลว</p>
                                </div>
                            )}

                            <div className="border border-line rounded-lg overflow-auto max-h-[45vh]">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 z-10 bg-card text-xs text-muted uppercase tracking-wide shadow-[0_1px_0_0_var(--color-line,#334155)]">
                                        <tr>
                                            <th className="p-2 w-10"></th>
                                            <th className="p-2 text-left">วันที่</th>
                                            <th className="p-2 text-left">เวลา</th>
                                            <th className="p-2 text-left">กิจกรรม</th>
                                            <th className="p-2 text-left">ห้อง</th>
                                            <th className="p-2 text-left">เสียง</th>
                                            <th className="p-2 text-left">สถานะ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line/50">
                                        {rows.map(r => {
                                            const isSaved = r.saveStatus === 'saved';
                                            const canSelect = r.status === 'ok' && !isSaved;
                                            const warning = rowWarnings.get(r.key);
                                            return (
                                                <tr key={r.key} className={!canSelect ? 'opacity-50' : undefined}>
                                                    <td className="p-2 align-top">
                                                        <input
                                                            type="checkbox"
                                                            checked={r.selected}
                                                            disabled={!canSelect || stage === 'saving'}
                                                            onChange={e => updateRow(r.key, { selected: e.target.checked })}
                                                            aria-label={`เลือกแถวที่ ${r.rowIndex}`}
                                                        />
                                                    </td>
                                                    <td className="p-2 align-top whitespace-nowrap">{r.rawDate || '-'}</td>
                                                    <td className="p-2 align-top whitespace-nowrap">
                                                        {canSelect ? (
                                                            <div className="flex gap-1">
                                                                <input
                                                                    type="number" min="0" max="23" value={r.h}
                                                                    disabled={stage === 'saving'}
                                                                    onChange={e => updateRow(r.key, { h: Number(e.target.value) || 0 })}
                                                                    className="w-12 bg-bg-soft border border-line rounded px-1 text-center"
                                                                    aria-label="ชั่วโมง"
                                                                />
                                                                :
                                                                <input
                                                                    type="number" min="0" max="59" value={r.m}
                                                                    disabled={stage === 'saving'}
                                                                    onChange={e => updateRow(r.key, { m: Number(e.target.value) || 0 })}
                                                                    className="w-12 bg-bg-soft border border-line rounded px-1 text-center"
                                                                    aria-label="นาที"
                                                                />
                                                            </div>
                                                        ) : (r.rawTime || '-')}
                                                        {canSelect && r.endH !== undefined && r.endM !== undefined && (
                                                            <div className="text-xs text-muted/70 mt-1">
                                                                ช่วงเดิม {formatHm(r.h, r.m)} – {formatHm(r.endH, r.endM)}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-2 align-top min-w-[220px] max-w-[320px] whitespace-normal break-words">
                                                        <div className="font-semibold">{r.activity || '-'}</div>
                                                        {r.source && <div className="text-xs text-muted mt-0.5">{r.source}</div>}
                                                        {!r.source && r.status === 'ok' && <div className="text-xs text-muted/70 mt-0.5">แถว {r.rowIndex}</div>}
                                                        {canSelect && (
                                                            ttsOpen.has(r.key) ? (
                                                                <input
                                                                    value={r.ttsText}
                                                                    onChange={e => updateRow(r.key, { ttsText: e.target.value })}
                                                                    placeholder="ข้อความ TTS (ถ้าต้องการ)"
                                                                    aria-label="ข้อความ TTS"
                                                                    className="mt-1 w-full bg-bg-soft border border-line rounded px-1 py-1 text-xs"
                                                                />
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setTtsOpen(prev => new Set(prev).add(r.key))}
                                                                    className="mt-1 text-xs text-primary hover:underline"
                                                                >
                                                                    {r.ttsText.trim() ? `แก้ข้อความ: ${r.ttsText.trim()}` : 'แก้ข้อความ'}
                                                                </button>
                                                            )
                                                        )}
                                                    </td>
                                                    <td className="p-2 align-top max-w-[120px] truncate" title={r.room}>{r.room || '-'}</td>
                                                    <td className="p-2 align-top">
                                                        {canSelect ? (
                                                            <select
                                                                value={r.audioId ?? ''}
                                                                disabled={stage === 'saving'}
                                                                onChange={e => {
                                                                    const audio = audioFiles.find(a => a.id === e.target.value);
                                                                    updateRow(r.key, {
                                                                        audioId: audio?.id ?? null,
                                                                        audioDisplayName: audio ? sanitizeAudioDisplayName(audio.displayName) : '',
                                                                    });
                                                                }}
                                                                className="bg-bg-soft border border-line rounded px-2 py-1 text-xs w-full min-w-[200px]"
                                                                aria-label="เลือกเสียง"
                                                            >
                                                                <option value="">เสียงมาตรฐาน</option>
                                                                {audioFiles.map(a => (
                                                                    <option key={a.id} value={a.id}>{a.displayName}</option>
                                                                ))}
                                                            </select>
                                                        ) : '-'}
                                                        {canSelect && (
                                                            <div className={`text-xs mt-1 whitespace-normal break-words ${r.audioId ? 'text-fg' : 'text-amber-500'}`}>
                                                                {r.audioId ? r.audioDisplayName : r.audioDisplayName ? `ไม่พบเสียง "${r.audioDisplayName}" ในคลัง` : 'เสียงมาตรฐาน'}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-2 align-top text-xs">
                                                        {isSaved ? (
                                                            <span className="text-green-500 font-semibold">✅ นำเข้าแล้ว</span>
                                                        ) : r.saveStatus === 'failed' ? (
                                                            <span className="text-danger" title={r.saveError}>❌ ล้มเหลว: {r.saveError}</span>
                                                        ) : r.status === 'error' ? (
                                                            <span className="text-danger">{r.errorReason}</span>
                                                        ) : !r.isToday ? (
                                                            <span className="text-muted">ไม่ใช่วันนี้</span>
                                                        ) : warning ? (
                                                            <span className="text-amber-500">{warning}</span>
                                                        ) : (
                                                            <span className="text-green-500">พร้อมนำเข้า</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {rows.length > 0 && selectableRows.length === 0 && !summary && (
                                <p className="text-sm text-muted">ไม่พบรายการของวันนี้ในไฟล์นี้ (เวอร์ชันนี้นำเข้าได้เฉพาะวันนี้)</p>
                            )}
                            {hasBlockingWarnings && (
                                <p className="text-sm text-danger font-semibold">
                                    มีรายการที่เวลาซ้ำกับตารางเดิมหรือชนกันเองในไฟล์นี้ — ต้องแก้เวลาหรือเลิกเลือกรายการที่ขึ้นเตือนก่อน จึงจะบันทึกได้ (ป้องกันนำเข้าซ้ำ)
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <div className="shrink-0 flex flex-wrap items-center gap-3 px-6 py-4 border-t border-line/50">
                    {stage === 'preview' && (
                        <>
                            <button onClick={onClose} className="px-4 py-2 rounded-lg hover:bg-white/5 transition-colors">
                                {summary ? 'ปิด' : 'ยกเลิก'}
                            </button>
                            <div className="flex flex-1 flex-wrap items-center gap-2 justify-end">
                                <input
                                    type="text"
                                    value={templateName}
                                    onChange={e => { setTemplateName(e.target.value); setTemplateSaved(null); }}
                                    placeholder="ชื่อ Template เช่น CPR-ACLS-รุ่น1"
                                    maxLength={60}
                                    aria-label="ชื่อ Template"
                                    className="bg-bg-soft border border-line rounded-lg px-3 py-2 text-sm w-56"
                                />
                                <button
                                    onClick={handleSaveTemplate}
                                    disabled={!canSaveTemplate}
                                    title={templateItems.length === 0 ? 'เลือกรายการก่อน' : templateName.trim() === '' ? 'ใส่ชื่อ Template ก่อน' : undefined}
                                    className="px-4 py-2 rounded-xl border border-line hover:bg-white/5 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    บันทึก Template ({templateItems.length})
                                </button>
                            </div>
                            <button
                                onClick={handleSave}
                                disabled={selectedCount === 0 || hasBlockingWarnings || !isCourseToday}
                                title={!isCourseToday ? 'เพิ่มเข้าตารางได้เฉพาะคอร์สของวันนี้ ใช้ "บันทึก Template" แทน' : hasBlockingWarnings ? 'มีรายการเวลาซ้ำ/ชนกัน แก้ไขก่อนบันทึก' : undefined}
                                className="px-6 py-2 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                เพิ่มเข้าตารางวันนี้ ({selectedCount})
                            </button>
                            {selectedCount > 0 && !isCourseToday && (
                                <p className="w-full text-xs text-muted text-right">
                                    ปุ่ม "เพิ่มเข้าตารางวันนี้" ปิดอยู่ เพราะวันคอร์ส ({courseDate ?? 'ไม่ทราบ'}) ไม่ใช่วันนี้ — ใช้ "บันทึก Template" เพื่อเก็บไว้ใช้วันคอร์ส
                                </p>
                            )}
                            {templateSaved && (
                                <p className="w-full text-sm text-green-500 text-right">{templateSaved}</p>
                            )}
                        </>
                    )}
                    {stage === 'saving' && (
                        <button disabled className="px-6 py-2 rounded-xl bg-primary text-white font-bold opacity-60">กำลังบันทึก...</button>
                    )}
                </div>
            </div>
        </div>
    );
}
