import { useState } from 'react';
import { useAlarms } from '../hooks/useAlarms';
import * as API from '../services/api';
import type { AlarmItem } from '../types';
import { EditAlarmModal } from './EditAlarmModal';

interface AlarmListProps {
    selected: Set<string>;
    onSelect: (selected: Set<string>) => void;
}

export function AlarmList({ selected, onSelect }: AlarmListProps) {
    const { items, removeItem, updateItem, addItem } = useAlarms();
    const [editingAlarm, setEditingAlarm] = useState<AlarmItem | null>(null);

    const toggleSelect = (id: string) => {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        onSelect(next);
    };

    const handlePlay = async (item: AlarmItem) => {
        if (item.audioId) {
            try {
                const url = API.getAudioUrl(item.audioId);
                const audio = new Audio(url);
                audio.play();
            } catch (e) {
                console.error(e);
            }
        }
    };

    const handleUpdate = async (id: string, updates: Partial<AlarmItem>) => {
        await updateItem(id, updates);
    };

    const handleDuplicate = async (item: AlarmItem) => {
        await addItem(item.h, item.m, item.s || 0, item.label || '', item.audioId, item.audioName);
    };

    if (items.length === 0) {
        return (
            <div className="text-center py-16">
                <div className="text-7xl mb-6 opacity-20 animate-pulse">⏰</div>
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
            {/* Column Headers (Hidden on mobile) */}
            <div className="hidden md:flex sticky top-0 bg-card/95 backdrop-blur-sm z-10 items-center justify-between px-4 py-3 text-xs font-bold text-muted/70 uppercase tracking-wider border-b border-line/50">
                <div className="w-10 flex items-center justify-center">
                    <input
                        type="checkbox"
                        checked={selected.size === items.length && items.length > 0}
                        onChange={(e) => onSelect(e.target.checked ? new Set(items.map(i => i.id)) : new Set())}
                        className="rounded border-line bg-bg-soft text-primary focus:ring-2 focus:ring-primary cursor-pointer"
                        aria-label="Select all alarms"
                        title={selected.size === items.length ? "Deselect all" : "Select all"}
                    />
                </div>
                <div className="w-28">Time</div>
                <div className="flex-1">Label</div>
                <div className="w-24 text-right">Status</div>
                <div className="w-36 text-right">Actions</div>
            </div>

            {/* Mobile Select All (Visible only on mobile) */}
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

            {/* Alarm Items */}
            <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {items.map(item => (
                    <div
                        key={item.id}
                        className={`group flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border transition-all duration-200 gap-3 md:gap-0 ${selected.has(item.id)
                            ? 'bg-primary/10 border-primary shadow-lg shadow-primary/10'
                            : 'bg-bg-soft/50 border-line hover:border-primary/50 hover:bg-bg-soft/80 hover:shadow-md'
                            }`}
                        role="listitem"
                        aria-label={`Alarm at ${item.h}:${item.m}:${item.s} - ${item.label || item.audioName || 'No label'}`}
                    >
                        {/* Top Row (Mobile): Checkbox + Time + Status */}
                        <div className="flex items-center justify-between w-full md:w-auto">
                            <div className="flex items-center gap-3">
                                {/* Checkbox */}
                                <div className="w-10 flex items-center justify-center md:hidden">
                                    <input
                                        type="checkbox"
                                        checked={selected.has(item.id)}
                                        onChange={() => toggleSelect(item.id)}
                                        className="rounded border-line bg-bg-soft text-primary focus:ring-2 focus:ring-primary cursor-pointer"
                                        aria-label={`Select alarm at ${item.h}:${item.m}:${item.s}`}
                                    />
                                </div>
                                <div className="hidden md:flex w-10 items-center justify-center">
                                    <input
                                        type="checkbox"
                                        checked={selected.has(item.id)}
                                        onChange={() => toggleSelect(item.id)}
                                        className="rounded border-line bg-bg-soft text-primary focus:ring-2 focus:ring-primary cursor-pointer"
                                        aria-label={`Select alarm at ${item.h}:${item.m}:${item.s}`}
                                    />
                                </div>

                                {/* Time Display */}
                                <div className={`text-2xl font-bold tabular-nums transition-colors ${item.notify_status === 'SENT' ? 'text-green-400' :
                                    item.notify_status === 'FAILED' ? 'text-danger' : 'text-fg'
                                    }`}>
                                    <span className="inline-block min-w-[2ch] text-right">{item.h.toString().padStart(2, '0')}</span>
                                    <span className="text-muted/50 mx-0.5">:</span>
                                    <span className="inline-block min-w-[2ch] text-right">{item.m.toString().padStart(2, '0')}</span>
                                    <span className="text-muted/50 mx-0.5">:</span>
                                    <span className="inline-block min-w-[2ch] text-right">{item.s?.toString().padStart(2, '0') || '00'}</span>
                                </div>
                            </div>

                            {/* Status Badge (Mobile) */}
                            <div className="md:hidden">
                                {item.notify_status !== 'PENDING' && (
                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${item.notify_status === 'SENT'
                                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                        : 'bg-danger/20 text-danger border border-danger/30'
                                        }`}>
                                        {item.notify_status}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Middle Row (Mobile): Label */}
                        <div className="flex-1 truncate px-0 md:px-3 w-full md:w-auto">
                            <div className="font-medium truncate text-fg">
                                {item.label || <span className="text-muted/50 italic">No label</span>}
                            </div>
                            {item.audioName && (
                                <div className="text-xs text-muted/60 truncate mt-0.5 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>
                                    </svg>
                                    {item.audioName}
                                </div>
                            )}
                        </div>

                        {/* Bottom Row (Mobile): Actions + Desktop Status */}
                        <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-4">
                            {/* Status Badge (Desktop) */}
                            <div className="hidden md:block w-24 text-right">
                                {item.notify_status !== 'PENDING' && (
                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${item.notify_status === 'SENT'
                                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                        : 'bg-danger/20 text-danger border border-danger/30'
                                        }`}>
                                        {item.notify_status === 'SENT' ? (
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                                            </svg>
                                        ) : (
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path>
                                            </svg>
                                        )}
                                        {item.notify_status}
                                    </span>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center justify-end gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity w-full md:w-36">
                                {item.audioId && (
                                    <button
                                        onClick={() => handlePlay(item)}
                                        className="p-3 md:p-2 hover:bg-primary/20 rounded-lg text-primary transition-all hover:scale-110"
                                        title="Play audio preview"
                                        aria-label="Play audio preview"
                                    >
                                        <svg className="w-5 h-5 md:w-4 md:h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path>
                                        </svg>
                                    </button>
                                )}
                                <button
                                    onClick={() => handleDuplicate(item)}
                                    className="p-3 md:p-2 hover:bg-primary/20 rounded-lg text-primary transition-all hover:scale-110"
                                    title="Duplicate alarm"
                                    aria-label="Duplicate alarm"
                                >
                                    <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                                    </svg>
                                </button>
                                <button
                                    onClick={() => setEditingAlarm(item)}
                                    className="p-3 md:p-2 hover:bg-primary/20 rounded-lg text-primary transition-all hover:scale-110"
                                    title="Edit alarm"
                                    aria-label="Edit alarm"
                                >
                                    <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                                    </svg>
                                </button>
                                <button
                                    onClick={() => removeItem(item.id)}
                                    className="p-3 md:p-2 hover:bg-danger/20 rounded-lg text-danger transition-all hover:scale-110"
                                    title="Delete alarm"
                                    aria-label="Delete alarm"
                                >
                                    <svg className="w-5 h-5 md:w-4 md:h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
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
