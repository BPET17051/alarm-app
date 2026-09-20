import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAlarms } from '../hooks/useAlarms';
import * as API from '../services/api';
import type { AlarmItem } from '../types';
import { EditAlarmModal } from './EditAlarmModal';
import { formatAudioName, playAudioFile } from '../utils/audio';

interface AlarmListProps {
    selected: Set<string>;
    onSelect: (selected: Set<string>) => void;
    serverTime: Date;
    playingIds: Set<string>;
}

// The scheduler only fires an alarm during the 60 seconds after its time (see useScheduler).
const MISSED_AFTER_SECONDS = 60;

function isMissed(item: AlarmItem, nowSeconds: number, playing: boolean) {
    if (item.notify_status !== 'PENDING' || playing) return false;
    return nowSeconds - (item.h * 3600 + item.m * 60 + (item.s || 0)) >= MISSED_AFTER_SECONDS;
}

function getAlarmThemeClasses(audioDisplayName: string) {
    const normalized = audioDisplayName.toLowerCase();

    if (normalized.includes('พัก')) {
        return { accent: 'bg-orange-400' };
    }

    if (
        normalized.includes('อีก10นาที')
        || normalized.includes('อีก 10 นาที')
        || normalized.includes('หมดเวลา')
        || normalized.includes('หมดเวลาสอบ')
    ) {
        return { accent: 'bg-sky-300' };
    }

    return { accent: '' };
}

function AlarmTime({ item, missed = false, mobile = false }: { item: AlarmItem; missed?: boolean; mobile?: boolean }) {
    const colorClass = item.notify_status === 'SENT'
        ? 'text-green-400'
        : item.notify_status === 'FAILED'
            ? 'text-danger'
            : missed
                ? 'text-amber-300'
                : 'text-fg';

    return (
        <div className={`${mobile ? 'text-2xl' : 'text-xl'} font-bold tabular-nums transition-colors ${colorClass}`}>
            <span className="inline-block min-w-[2ch] text-right">{item.h.toString().padStart(2, '0')}</span>
            <span className="text-muted/50 mx-0.5">:</span>
            <span className="inline-block min-w-[2ch] text-right">{item.m.toString().padStart(2, '0')}</span>
            <span className="text-muted/50 mx-0.5">:</span>
            <span className="inline-block min-w-[2ch] text-right">{item.s?.toString().padStart(2, '0') || '00'}</span>
        </div>
    );
}

function AlarmStatus({ item, missed = false, playing = false, mobile = false }: { item: AlarmItem; missed?: boolean; playing?: boolean; mobile?: boolean }) {
    if (item.notify_status === 'PENDING' && !missed && !playing) {
        return null;
    }

    const state = playing ? 'playing' : missed ? 'missed' : item.notify_status === 'SENT' ? 'sent' : 'failed';
    const badgeClass = {
        playing: 'bg-sky-500/20 text-sky-300 border border-sky-500/30',
        missed: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
        sent: 'bg-green-500/20 text-green-400 border border-green-500/30',
        failed: 'bg-danger/20 text-danger border border-danger/30',
    }[state];
    const label = { playing: 'กำลังเล่น', missed: 'พลาดเวลา', sent: 'เล่นแล้ว', failed: 'ล้มเหลว' }[state];

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold ${badgeClass}`}>
            {!mobile && state === 'sent' && (
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                </svg>
            )}
            {!mobile && (state === 'failed' || state === 'missed') && (
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path>
                </svg>
            )}
            {label}
        </span>
    );
}

export function AlarmList({ selected, onSelect, serverTime, playingIds }: AlarmListProps) {
    const nowSeconds = serverTime.getHours() * 3600 + serverTime.getMinutes() * 60 + serverTime.getSeconds();
    const { items, alarmsStatus, alarmsError, retryLoadAlarms, removeItem, updateItem, addItem } = useAlarms();
    const [editingAlarm, setEditingAlarm] = useState<AlarmItem | null>(null);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [desktopMenuPosition, setDesktopMenuPosition] = useState<{ top: number; right: number; placement: 'up' | 'down' } | null>(null);
    const openMenuItem = openMenuId ? items.find((item) => item.id === openMenuId) ?? null : null;

    const toggleSelect = (id: string) => {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        onSelect(next);
    };

    const handlePlay = async (item: AlarmItem) => {
        if (!item.audioId || playingId) return;
        setPlayingId(item.id);
        try {
            const url = API.getAudioUrl(item.audioId);
            await playAudioFile(url);
        } catch (e) {
            console.error(e);
        } finally {
            setPlayingId(null);
        }
    };

    const handleUpdate = async (id: string, updates: Partial<AlarmItem>) => {
        await updateItem(id, updates);
    };

    const handleDuplicate = async (item: AlarmItem) => {
        await addItem(item.h, item.m, item.s || 0, item.audioId, item.audioDisplayName);
        setOpenMenuId(null);
        setDesktopMenuPosition(null);
    };

    useEffect(() => {
        if (!openMenuId) return;

        const closeMenu = () => {
            setOpenMenuId(null);
            setDesktopMenuPosition(null);
        };

        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest('[data-alarm-menu]') || target?.closest('[data-alarm-menu-trigger]')) {
                return;
            }
            closeMenu();
        };

        window.addEventListener('resize', closeMenu);
        window.addEventListener('scroll', closeMenu, true);
        document.addEventListener('mousedown', handlePointerDown);

        return () => {
            window.removeEventListener('resize', closeMenu);
            window.removeEventListener('scroll', closeMenu, true);
            document.removeEventListener('mousedown', handlePointerDown);
        };
    }, [openMenuId]);

    const renderMenuContent = (item: AlarmItem) => (
        <>
            <button
                onClick={() => handleDuplicate(item)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-bg-soft"
            >
                ทำซ้ำ
            </button>
            <button
                onClick={() => {
                    setEditingAlarm(item);
                    setOpenMenuId(null);
                    setDesktopMenuPosition(null);
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-bg-soft"
            >
                แก้ไข
            </button>
            <button
                onClick={() => {
                    void removeItem(item.id);
                    setOpenMenuId(null);
                    setDesktopMenuPosition(null);
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-danger hover:bg-danger/10"
            >
                ลบ
            </button>
        </>
    );

    const renderActions = (item: AlarmItem, mobile = false, desktopMenuDirection: 'up' | 'down' = 'down') => (
        <div className={`relative flex items-center justify-end gap-1.5 ${mobile ? 'w-full' : 'opacity-100'}`}>
            {item.audioId && (
                <button
                    onClick={() => handlePlay(item)}
                    disabled={!!playingId}
                    className={`${mobile ? 'h-11 w-11' : 'h-9 w-9'} inline-flex items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary transition-colors hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-40 disabled:cursor-not-allowed`}
                    title={playingId === item.id ? 'กำลังเล่น...' : 'ฟังตัวอย่างเสียง'}
                    aria-label={playingId === item.id ? 'กำลังเล่นตัวอย่างเสียง' : 'ฟังตัวอย่างเสียง'}
                >
                    {playingId === item.id ? (
                        <svg className={`${mobile ? 'w-5 h-5' : 'w-4 h-4'} animate-spin`} fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                    ) : (
                        <svg className={`${mobile ? 'w-5 h-5' : 'w-4 h-4'}`} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                    )}
                </button>
            )}
            <button
                onClick={(event) => {
                    const nextOpen = openMenuId === item.id ? null : item.id;
                    setOpenMenuId(nextOpen);

                    if (!mobile && nextOpen) {
                        const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                        setDesktopMenuPosition(
                            desktopMenuDirection === 'up'
                                ? { top: rect.top - 8, right: window.innerWidth - rect.right, placement: 'up' }
                                : { top: rect.bottom + 8, right: window.innerWidth - rect.right, placement: 'down' }
                        );
                    } else if (!mobile) {
                        setDesktopMenuPosition(null);
                    }
                }}
                data-alarm-menu-trigger="true"
                className={`${mobile ? 'h-11 w-11' : 'h-9 w-9'} inline-flex items-center justify-center rounded-lg border border-line bg-bg-soft/60 text-primary transition-colors hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/50`}
                title="เมนูเพิ่มเติม"
                aria-label="เมนูเพิ่มเติม"
            >
                <svg className={`${mobile ? 'w-5 h-5' : 'w-4 h-4'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6h.01M12 12h.01M12 18h.01" />
                </svg>
            </button>
            {mobile && openMenuId === item.id && (
                <div className="absolute right-4 bottom-14 z-20 min-w-[150px] rounded-xl border border-line bg-card shadow-xl p-1" data-alarm-menu="true">
                    {renderMenuContent(item)}
                </div>
            )}
        </div>
    );

    if (alarmsStatus === 'loading') {
        return (
            <div className="text-center py-16" role="status" aria-live="polite">
                <div className="mx-auto mb-5 h-10 w-10 rounded-full border-4 border-line border-t-primary animate-spin" aria-hidden="true" />
                <h3 className="text-xl font-bold text-muted mb-2">กำลังโหลดตารางประกาศ</h3>
                <p className="text-muted/70">กำลังเชื่อมต่อระบบ...</p>
            </div>
        );
    }

    if (alarmsStatus === 'error') {
        return (
            <div className="my-8 rounded-2xl border border-danger/50 bg-danger/10 px-6 py-8 text-center" role="alert" aria-live="assertive">
                <svg className="mx-auto mb-4 h-12 w-12 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v4m0 4h.01M10.29 3.86l-8.82 15.29A1 1 0 002.34 20h19.32a1 1 0 00.87-1.5L13.71 3.86a1 1 0 00-1.72 0z" />
                </svg>
                <h3 className="text-xl font-bold text-danger mb-2">โหลดตารางประกาศไม่สำเร็จ</h3>
                <p className="mx-auto max-w-lg text-muted mb-2">{alarmsError}</p>
                <p className="text-sm font-semibold text-fg mb-6">อย่าเข้าใจว่าตารางว่าง — รายการอาจยังอยู่ แต่โหลดมาไม่ได้</p>
                <button
                    type="button"
                    onClick={() => void retryLoadAlarms()}
                    className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-white transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/60"
                >
                    ลองเชื่อมต่อใหม่
                </button>
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="text-center py-16">
                <div className="mb-6 flex justify-center opacity-20">
                    <svg className="w-16 h-16 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                </div>
                <h3 className="text-xl font-bold text-fg mb-2">ยังไม่มีรายการประกาศ</h3>
                <p className="text-muted mb-6">เริ่มจากเพิ่มรายการแรกได้เลย</p>
                <button
                    type="button"
                    onClick={() => {
                        const hours = document.getElementById('hours');
                        hours?.scrollIntoView({ block: 'center' });
                        hours?.focus();
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-line bg-white/5 hover:bg-white/10 text-fg font-semibold focus:outline-none focus:ring-2 focus:ring-white/60"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                    </svg>
                    เริ่มเพิ่มรายการแรก
                </button>
            </div>
        );
    }

    const missedCount = items.filter((item) => isMissed(item, nowSeconds, playingIds.has(item.id))).length;

    return (
        <div className="space-y-3">
            {missedCount > 0 && (
                <div role="alert" className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-amber-200">
                    <div className="font-bold">มี {missedCount} รายการเลยเวลาแล้วแต่ยังไม่ได้เล่น</div>
                    <div className="text-sm">ตรวจสอบว่าประกาศไปแล้วหรือยัง แล้วประกาศเองหากจำเป็น</div>
                </div>
            )}
            <div className="hidden md:flex sticky top-0 bg-card/95 backdrop-blur-sm z-10 items-center gap-4 px-4 py-3 text-xs font-bold text-muted/70 uppercase tracking-wider border-b border-line/50">
                <div className="w-9 flex items-center justify-center">
                    <input
                        type="checkbox"
                        checked={selected.size === items.length && items.length > 0}
                        onChange={(e) => onSelect(e.target.checked ? new Set(items.map(i => i.id)) : new Set())}
                        className="rounded border-line bg-bg-soft text-primary focus:ring-2 focus:ring-primary cursor-pointer"
                        aria-label="เลือกทุกรายการ"
                        title={selected.size === items.length ? 'ยกเลิกการเลือกทั้งหมด' : 'เลือกทั้งหมด'}
                    />
                </div>
                <div className="w-32">เวลา</div>
                <div className="flex-1 min-w-0">ไฟล์เสียง</div>
                <div className="w-20 text-right">สถานะ</div>
                <div className="w-24 text-right">จัดการ</div>
            </div>

            <div className="md:hidden flex items-center justify-between px-4 py-2 mb-2">
                <label className="flex items-center gap-2 text-sm text-muted">
                    <input
                        type="checkbox"
                        checked={selected.size === items.length && items.length > 0}
                        onChange={(e) => onSelect(e.target.checked ? new Set(items.map(i => i.id)) : new Set())}
                        className="rounded border-line bg-bg-soft text-primary focus:ring-2 focus:ring-primary cursor-pointer"
                    />
                    เลือกทั้งหมด
                </label>
            </div>

            <div
                className="h-[min(54vh,520px)] min-h-[340px] overflow-y-auto space-y-2 pr-2 custom-scrollbar"
                role="list"
                aria-label="ตารางประกาศ"
            >
                {items.map((item, index) => {
                    const audioDisplay = formatAudioName(item.audioDisplayName);
                    const theme = getAlarmThemeClasses(audioDisplay);
                    const missed = isMissed(item, nowSeconds, playingIds.has(item.id));
                    const playing = playingIds.has(item.id);
                    const desktopMenuDirection: 'up' | 'down' =
                        items.length <= 2 || index >= items.length - 2 ? 'up' : 'down';

                    return (
                        <div
                            key={item.id}
                            className={`group rounded-xl border transition-all duration-200 ${selected.has(item.id)
                                ? 'bg-primary/10 border-primary shadow-lg shadow-primary/10'
                                : 'bg-bg-soft/50 border-line hover:border-primary/50 hover:bg-bg-soft/80 hover:shadow-md'
                                }`}
                            role="listitem"
                            aria-label={`รายการเวลา ${item.h}:${item.m}:${item.s} - ${audioDisplay}`}
                        >
                            <div className="hidden md:grid md:grid-cols-[2.25rem_8rem_minmax(0,1fr)_5rem_6rem] items-center gap-3 px-4 py-3 min-h-[78px]">
                                <div className="flex items-center justify-center shrink-0">
                                    <input
                                        type="checkbox"
                                        checked={selected.has(item.id)}
                                        onChange={() => toggleSelect(item.id)}
                                        className="rounded border-line bg-bg-soft text-primary focus:ring-2 focus:ring-primary cursor-pointer"
                                        aria-label={`เลือกรายการเวลา ${item.h}:${item.m}:${item.s}`}
                                    />
                                </div>
                                <div className="shrink-0">
                                    <AlarmTime item={item} missed={missed} />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-start gap-3 min-w-0">
                                        <span className={`mt-1 h-10 w-1.5 rounded-full shrink-0 ${theme.accent || 'bg-line'}`} aria-hidden="true" />
                                        <div className="min-w-0">
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-muted/60 leading-none mb-1">
                                                ไฟล์เสียง
                                            </div>
                                            <div className="line-clamp-2 font-bold text-base leading-snug text-fg" title={audioDisplay}>
                                                {audioDisplay}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <AlarmStatus item={item} missed={missed} playing={playing} />
                                </div>
                                <div className="shrink-0 relative">
                                    {renderActions(item, false, desktopMenuDirection)}
                                </div>
                            </div>

                            <div className="md:hidden p-3 space-y-2 min-h-[112px]">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-9 flex items-center justify-center shrink-0 pt-1">
                                            <input
                                                type="checkbox"
                                                checked={selected.has(item.id)}
                                                onChange={() => toggleSelect(item.id)}
                                                className="rounded border-line bg-bg-soft text-primary focus:ring-2 focus:ring-primary cursor-pointer"
                                                aria-label={`เลือกรายการเวลา ${item.h}:${item.m}:${item.s}`}
                                            />
                                        </div>
                                        <AlarmTime item={item} missed={missed} mobile />
                                    </div>
                                    <div className="shrink-0 pt-1">
                                        <AlarmStatus item={item} missed={missed} playing={playing} mobile />
                                    </div>
                                </div>
                                <div className="pl-12 min-w-0">
                                    <div className="flex items-start gap-2 min-w-0">
                                        <span className={`mt-1 h-9 w-1.5 rounded-full shrink-0 ${theme.accent || 'bg-line'}`} aria-hidden="true" />
                                        <div className="min-w-0">
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-muted/60 leading-none mb-1">
                                                ไฟล์เสียง
                                            </div>
                                            <div className="line-clamp-2 font-bold text-base leading-snug text-fg" title={audioDisplay}>
                                            {audioDisplay}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="relative pl-12">
                                    {renderActions(item, true)}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {editingAlarm && (
                <EditAlarmModal
                    alarm={editingAlarm}
                    isOpen={!!editingAlarm}
                    onClose={() => setEditingAlarm(null)}
                    onUpdate={handleUpdate}
                />
            )}

            {!editingAlarm && openMenuItem && desktopMenuPosition && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed z-[80] min-w-[150px] rounded-xl border border-line bg-card shadow-xl p-1"
                    style={{
                        top: desktopMenuPosition.top,
                        right: desktopMenuPosition.right,
                        transform: desktopMenuPosition.placement === 'up' ? 'translateY(-100%)' : undefined,
                    }}
                    data-alarm-menu="true"
                >
                    {renderMenuContent(openMenuItem)}
                </div>,
                document.body
            )}
        </div>
    );
}
