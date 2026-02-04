import React, { useState } from 'react';
import { useAlarms } from '../hooks/useAlarms';
import * as API from '../services/api';
import { AudioSelectionModal } from './AudioSelectionModal';
import type { AudioSelection } from './AudioSelectionModal';

export function AlarmForm() {
    const { addItem } = useAlarms();
    const [h, setH] = useState(new Date().getHours());
    const [m, setM] = useState(new Date().getMinutes());
    const [s, setS] = useState(0);
    const [label, setLabel] = useState('');

    // Audio selection state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [audioSelection, setAudioSelection] = useState<AudioSelection | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return;

        setIsSubmitting(true);

        try {
            let audioId = null;
            let audioName = '';

            // Default fallback if nothing selected? Or maybe validation error?
            // For now, let's treat null as default sound or similar logic as before (backend handles empty audioId?)
            // Actually previous code handled it. If audioSelection is null, it sends null/empty.

            if (audioSelection?.source === 'upload') {
                const saved = await API.uploadAudio(audioSelection.file, audioSelection.name);
                audioId = saved.id;
                audioName = saved.name || audioSelection.file.name;
            } else if (audioSelection?.source === 'select') {
                audioId = audioSelection.id;
                audioName = audioSelection.name;
            }

            await addItem(h, m, s, label, audioId, audioName);

            // Show success feedback
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);

            // Reset form
            setLabel('');
            setAudioSelection(null);

        } catch (e: unknown) {
            console.error('Operation failed', e);
            const msg = e instanceof Error ? e.message : String(e);
            alert(`Failed: ${msg}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const isValid = !isNaN(h) && !isNaN(m) && !isNaN(s);

    const getSelectionDisplay = () => {
        if (!audioSelection) return 'Default Alarm Sound';
        if (audioSelection.source === 'upload') {
            return `Upload: ${audioSelection.name || audioSelection.file.name}`;
        }
        return `Selected: ${audioSelection.name}`;
    };

    return (
        <>
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Time Input Section */}
                <div>
                    <label className="block text-sm font-bold text-muted mb-3 uppercase tracking-wider">
                        Set Time
                    </label>
                    <div className="bg-bg-soft/50 border border-line/50 rounded-xl p-4">
                        <div className="grid grid-cols-3 gap-3">
                            <div className="flex flex-col">
                                <label htmlFor="hours" className="text-xs font-semibold text-muted/70 mb-1 text-center uppercase tracking-wide">Hours</label>
                                <input
                                    id="hours" type="number" min="0" max="23" value={h}
                                    onChange={e => setH(parseInt(e.target.value) || 0)}
                                    className="w-full bg-bg border border-line rounded-lg p-3 text-center text-2xl font-bold focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                                />
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="minutes" className="text-xs font-semibold text-muted/70 mb-1 text-center uppercase tracking-wide">Minutes</label>
                                <input
                                    id="minutes" type="number" min="0" max="59" value={m}
                                    onChange={e => setM(parseInt(e.target.value) || 0)}
                                    className="w-full bg-bg border border-line rounded-lg p-3 text-center text-2xl font-bold focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                                />
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="seconds" className="text-xs font-semibold text-muted/70 mb-1 text-center uppercase tracking-wide">Seconds</label>
                                <input
                                    id="seconds" type="number" min="0" max="59" value={s}
                                    onChange={e => setS(parseInt(e.target.value) || 0)}
                                    className="w-full bg-bg border border-line rounded-lg p-3 text-center text-2xl font-bold focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Audio Source Trigger */}
                <div>
                    <label className="block text-sm font-bold text-muted mb-3 uppercase tracking-wider">
                        Audio Source
                    </label>

                    <div
                        onClick={() => setIsModalOpen(true)}
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
                                        {audioSelection ? (audioSelection.source === 'upload' ? 'Ready to upload' : 'Selected from library') : 'Click to choose custom audio'}
                                    </span>
                                </div>
                            </div>
                            <svg className="w-5 h-5 text-muted group-hover:text-primary transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Label Input */}
                <div>
                    <label htmlFor="alarm-label" className="block text-sm font-bold text-muted mb-2 uppercase tracking-wider">
                        Label <span className="text-muted/50 font-normal">(Optional)</span>
                    </label>
                    <input
                        id="alarm-label"
                        type="text"
                        placeholder="e.g., Meeting, Wake up, Break time..."
                        className="w-full bg-bg-soft border border-line rounded-xl p-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                        value={label}
                        onChange={e => setLabel(e.target.value)}
                    />
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={!isValid || isSubmitting}
                    className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-xl transition-all transform active:scale-[0.98] shadow-lg shadow-primary/25 hover:shadow-primary/40 disabled:shadow-none flex items-center justify-center gap-2"
                >
                    {isSubmitting ? (
                        <>
                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Saving...
                        </>
                    ) : showSuccess ? (
                        <>
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            Added!
                        </>
                    ) : (
                        <>
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                            </svg>
                            Add Alarm
                        </>
                    )}
                </button>
            </form>

            <AudioSelectionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onConfirm={(selection) => setAudioSelection(selection)}
                currentSelection={audioSelection}
            />
        </>
    );
}
