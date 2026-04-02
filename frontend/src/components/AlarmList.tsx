import { useState } from 'react';
import { useAlarms } from '../hooks/useAlarms';
import * as API from '../services/api';
import type { AlarmItem } from '../types';
import { EditAlarmModal } from './EditAlarmModal';
import { formatAudioName, playAudioFile } from '../utils/audio';

interface AlarmListProps {
    selected: Set<string>;
    onSelect: (selected: Set<string>) => void;
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

function AlarmTime({ item, mobile = false }: { item: AlarmItem; mobile?: boolean }) {
    const colorClass = item.notify_status === 'SENT'
        ? 'text-green-400'
        : item.notify_status === 'FAILED'
            ? 'text-danger'
            : 'text-fg';

    return (
        <div className={`${mobile ? 'text-2xl' : 'text-lg'} font-bold tabular-nums transition-colors ${colorClass}`}>
            <span className="inline-block min-w-[2ch] text-right">{item.h.toString().padStart(2, '0')}</span>
            <span className="text-muted/50 mx-0.5">:</span>
            <span className="inline-block min-w-[2ch] text-right">{item.m.toString().padStart(2, '0')}</span>
            <span className="text-muted/50 mx-0.5">:</span>
            <span className="inline-block min-w-[2ch] text-right">{item.s?.toString().padStart(2, '0') || '00'}</span>
        </div>
    );
}

function AlarmStatus({ item, mobile = false }: { item: AlarmItem; mobile?: boolean }) {
    if (item.notify_status === 'PENDING') {
        return null;
    }

    const badgeClass = item.notify_status === 'SENT'
        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
        : 'bg-danger/20 text-danger border border-danger/30';

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${badgeClass}`}>
            {!mobile && item.notify_status === 'SENT' && (
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                </svg>
            )}
            {!mobile && item.notify_status === 'FAILED' && (
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path>
                </svg>
            )}
            {item.notify_status}
        </span>
    );
}

export function AlarmList({ selected, onSelect }: AlarmListProps) {
    const { items, removeItem, updateItem, addItem } = useAlarms();
    const [editingAlarm, setEditingAlarm] = useState<AlarmItem | null>(null);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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
    };

    const renderActions = (item: AlarmItem, mobile = false, desktopMenuDirection: 'up' | 'down' = 'down') => (
        <div className={`relative flex items-center justify-end gap-1.5 ${mobile ? 'w-full' : openMenuId === item.id ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity'}`}>
            {item.audioId && (
                <button
                    onClick={() => handlePlay(item)}
                    disabled={!!playingId}
                    className={`${mobile ? 'p-3' : 'p-2'} hover:bg-primary/20 rounded-lg text-primary transition-all hover:scale-110 disabled:opacity-40 disabled:cursor-not-allowed`}
                    title={playingId === item.id ? 'Playing...' : 'Play audio preview'}
                    aria-label={playingId === item.id ? 'Playing audio preview' : 'Play audio preview'}
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
                onClick={() => setOpenMenuId(current => current === item.id ? null : item.id)}
                className={`${mobile ? 'p-3' : 'p-2'} hover:bg-primary/20 rounded-lg text-primary transition-all hover:scale-110`}
                title="More actions"
                aria-label="More actions"
            >
                <svg className={`${mobile ? 'w-5 h-5' : 'w-4 h-4'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6h.01M12 12h.01M12 18h.01" />
                </svg>
            </button>
            {openMenuId === item.id && (
                <div className={`absolute ${
                    mobile
                        ? 'right-4 bottom-14'
                        : desktopMenuDirection === 'up'
                            ? 'right-4 bottom-12'
                            : 'right-4 top-12'
                } z-20 min-w-[150px] rounded-xl border border-line bg-card shadow-xl p-1`}>
                    <button
                        onClick={() => handleDuplicate(item)}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-bg-soft"
                    >
                        Duplicate
                    </button>
                    <button
                        onClick={() => {
                            setEditingAlarm(item);
                            setOpenMenuId(null);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-bg-soft"
                    >
                        Edit
                    </button>
                    <button
                        onClick={() => {
                            void removeItem(item.id);
                            setOpenMenuId(null);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm text-danger hover:bg-danger/10"
                    >
                        Delete
                    </button>
                </div>
            )}
        </div>
    );

    if (items.length === 0) {
        return (
            <div className="text-center py-16">
                <div className="mb-6 flex justify-center opacity-20">
                    <svg className="w-16 h-16 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                </div>
                <h3 className="text-xl font-bold text-muted mb-2">No Alarms Yet</h3>
                <p className="text-muted/70 mb-6">Get started by adding your first alarm</p>
                <div className="inline-flex items-center gap-2 text-sm text-muted/50 bg-bg-soft/50 px-4 py-2 rounded-lg border border-line/50">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                    </svg>
                    Use the form on the left
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="hidden md:flex sticky top-0 bg-card/95 backdrop-blur-sm z-10 items-center gap-4 px-4 py-3 text-xs font-bold text-muted/70 uppercase tracking-wider border-b border-line/50">
                <div className="w-11 flex items-center justify-center">
                    <input
                        type="checkbox"
                        checked={selected.size === items.length && items.length > 0}
                        onChange={(e) => onSelect(e.target.checked ? new Set(items.map(i => i.id)) : new Set())}
                        className="rounded border-line bg-bg-soft text-primary focus:ring-2 focus:ring-primary cursor-pointer"
                        aria-label="Select all alarms"
                        title={selected.size === items.length ? 'Deselect all' : 'Select all'}
                    />
                </div>
                <div className="w-24">Time</div>
                <div className="flex-1 min-w-0">Audio</div>
                <div className="w-24 text-right">Status</div>
                <div className="w-40 text-right">Actions</div>
            </div>

            <div className="md:hidden flex items-center justify-between px-4 py-2 mb-2">
                <label className="flex items-center gap-2 text-sm text-muted">
                    <input
                        type="checkbox"
                        checked={selected.size === items.length && items.length > 0}
                        onChange={(e) => onSelect(e.target.checked ? new Set(items.map(i => i.id)) : new Set())}
                        className="rounded border-line bg-bg-soft text-primary focus:ring-2 focus:ring-primary cursor-pointer"
                    />
                    Select All
                </label>
            </div>

            <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {items.map((item, index) => {
                    const audioDisplay = formatAudioName(item.audioDisplayName);
                    const theme = getAlarmThemeClasses(audioDisplay);
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
                            aria-label={`Alarm at ${item.h}:${item.m}:${item.s} - ${audioDisplay}`}
                        >
                            <div className="hidden md:flex items-center gap-3 p-4">
                                <div className="w-11 flex items-center justify-center shrink-0">
                                    <input
                                        type="checkbox"
                                        checked={selected.has(item.id)}
                                        onChange={() => toggleSelect(item.id)}
                                        className="rounded border-line bg-bg-soft text-primary focus:ring-2 focus:ring-primary cursor-pointer"
                                        aria-label={`Select alarm at ${item.h}:${item.m}:${item.s}`}
                                    />
                                </div>
                                <div className="w-24 shrink-0">
                                    <AlarmTime item={item} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 min-w-0">
                                        {theme.accent && (
                                            <span className={`h-8 w-1.5 rounded-full shrink-0 ${theme.accent}`} aria-hidden="true" />
                                        )}
                                        <div className="font-bold text-xl leading-tight text-fg truncate" title={audioDisplay}>
                                            {audioDisplay}
                                        </div>
                                    </div>
                                </div>
                                <div className="w-24 text-right shrink-0">
                                    <AlarmStatus item={item} />
                                </div>
                                <div className="w-24 shrink-0 relative">
                                    {renderActions(item, false, desktopMenuDirection)}
                                </div>
                            </div>

                            <div className="md:hidden p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 flex items-center justify-center">
                                            <input
                                                type="checkbox"
                                                checked={selected.has(item.id)}
                                                onChange={() => toggleSelect(item.id)}
                                                className="rounded border-line bg-bg-soft text-primary focus:ring-2 focus:ring-primary cursor-pointer"
                                                aria-label={`Select alarm at ${item.h}:${item.m}:${item.s}`}
                                            />
                                        </div>
                                        <AlarmTime item={item} mobile />
                                    </div>
                                    <div>
                                        <AlarmStatus item={item} mobile />
                                    </div>
                                </div>
                                <div className="pl-[3.25rem] min-w-0">
                                    <div className="flex items-center gap-2 min-w-0">
                                        {theme.accent && (
                                            <span className={`h-6 w-1.5 rounded-full shrink-0 ${theme.accent}`} aria-hidden="true" />
                                        )}
                                        <div className="font-bold text-base leading-tight text-fg truncate" title={audioDisplay}>
                                            {audioDisplay}
                                        </div>
                                    </div>
                                </div>
                                <div className="relative">
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
        </div>
    );
}
