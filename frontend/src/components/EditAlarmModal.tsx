import React, { useState, useEffect } from 'react';
import type { AlarmItem } from '../types';
import { AudioSelectionModal } from './AudioSelectionModal';
import type { AudioSelection } from './AudioSelectionModal';
import { normalizeTime } from '../utils/time';

interface EditAlarmModalProps {
    alarm: AlarmItem;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: (id: string, updates: Partial<AlarmItem>) => Promise<void>;
}

export function EditAlarmModal({ alarm, isOpen, onClose, onUpdate }: EditAlarmModalProps) {
    const [h, setH] = useState(alarm.h);
    const [m, setM] = useState(alarm.m);
    const [s, setS] = useState(alarm.s || 0);
    const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
    const [audioSelection, setAudioSelection] = useState<AudioSelection | null>(null);

    useEffect(() => {
        if (isOpen) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setH(alarm.h);
            setM(alarm.m);
            setS(alarm.s || 0);
            setAudioSelection(alarm.audioId ? {
                source: 'select',
                id: alarm.audioId,
                displayName: alarm.audioDisplayName,
                fileName: ''
            } : null);
        }
    }, [isOpen, alarm]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const audioId = audioSelection?.source === 'select' ? audioSelection.id : null;
        const audioDisplayName = audioSelection?.source === 'select' ? audioSelection.displayName : '';
        const nextTime = normalizeTime(h, m, s);

        await onUpdate(alarm.id, { h: nextTime.h, m: nextTime.m, s: nextTime.s, audioId, audioDisplayName });
        onClose();
    };

    const isValid = !isNaN(h) && !isNaN(m) && !isNaN(s);

    const handleTimeChange = (part: 'h' | 'm' | 's', rawValue: string) => {
        const parsed = Number.parseInt(rawValue, 10);
        const nextValue = Number.isNaN(parsed) ? 0 : parsed;
        const nextTime = normalizeTime(
            part === 'h' ? nextValue : h,
            part === 'm' ? nextValue : m,
            part === 's' ? nextValue : s
        );

        setH(nextTime.h);
        setM(nextTime.m);
        setS(nextTime.s);
    };

    const getSelectionDisplay = () => {
        if (!audioSelection || audioSelection.source !== 'select') return 'Default Alarm Sound';
        return `Selected: ${audioSelection.displayName}`;
    };

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="bg-card border border-line rounded-2xl w-full max-w-md p-6 shadow-2xl animate-scale-in">
                    <h2 className="text-xl font-bold text-fg mb-6">Edit Alarm</h2>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Time Input Section */}
                        <div>
                            <label className="block text-sm font-bold text-muted mb-3 uppercase tracking-wider">
                                Set Time
                            </label>
                            <div className="bg-bg-soft/50 border border-line/50 rounded-xl p-4">
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="flex flex-col">
                                        <label htmlFor="edit-hours" className="text-xs font-semibold text-muted/70 mb-1 text-center uppercase tracking-wide">
                                            Hours
                                        </label>
                                        <input
                                            id="edit-hours"
                                            type="number"
                                            min="0"
                                            max="23"
                                            value={h}
                                            onChange={e => handleTimeChange('h', e.target.value)}
                                            className="w-full bg-bg border border-line rounded-lg p-3 text-center text-2xl font-bold focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                                        />
                                    </div>

                                    <div className="flex flex-col">
                                        <label htmlFor="edit-minutes" className="text-xs font-semibold text-muted/70 mb-1 text-center uppercase tracking-wide">
                                            Minutes
                                        </label>
                                        <input
                                            id="edit-minutes"
                                            type="number"
                                            min="0"
                                            max="59"
                                            value={m}
                                            onChange={e => handleTimeChange('m', e.target.value)}
                                            className="w-full bg-bg border border-line rounded-lg p-3 text-center text-2xl font-bold focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                                        />
                                    </div>

                                    <div className="flex flex-col">
                                        <label htmlFor="edit-seconds" className="text-xs font-semibold text-muted/70 mb-1 text-center uppercase tracking-wide">
                                            Seconds
                                        </label>
                                        <input
                                            id="edit-seconds"
                                            type="number"
                                            min="0"
                                            max="59"
                                            value={s}
                                            onChange={e => handleTimeChange('s', e.target.value)}
                                            className="w-full bg-bg border border-line rounded-lg p-3 text-center text-2xl font-bold focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-muted mb-3 uppercase tracking-wider">
                                Audio Source
                            </label>
                            <div
                                onClick={() => setIsAudioModalOpen(true)}
                                className="bg-bg-soft/30 border border-line rounded-xl p-4 cursor-pointer hover:bg-bg-soft/50 hover:border-primary/50 transition-all group"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${audioSelection ? 'bg-primary/20 text-primary' : 'bg-bg-soft text-muted'}`}>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                            </svg>
                                        </div>
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="text-sm font-bold truncate group-hover:text-primary transition-colors">
                                                {getSelectionDisplay()}
                                            </span>
                                            <span className="text-xs text-muted truncate">
                                                {audioSelection ? 'Selected from library' : 'Click to choose audio from the system library'}
                                            </span>
                                        </div>
                                    </div>
                                    <svg className="w-5 h-5 text-muted group-hover:text-primary transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </div>
                            {alarm.audioDisplayName && !audioSelection && (
                                <p className="mt-2 text-xs text-muted/70">
                                    Current audio: {alarm.audioDisplayName}
                                </p>
                            )}
                            <p className="mt-2 text-xs text-muted/60">
                                Editing uses only audio already uploaded to the system.
                            </p>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-4 py-3 rounded-xl border border-line text-muted hover:bg-bg-soft transition-colors font-semibold"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!isValid}
                                className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40"
                            >
                                Save Changes
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <AudioSelectionModal
                isOpen={isAudioModalOpen}
                onClose={() => setIsAudioModalOpen(false)}
                onConfirm={(selection) => setAudioSelection(selection)}
                currentSelection={audioSelection}
                allowUpload={false}
            />
        </>
    );
}
