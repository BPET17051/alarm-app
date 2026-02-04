import React, { useState, useRef, useEffect } from 'react';
import * as API from '../services/api';
import type { AlarmItem } from '../types';

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
    const [label, setLabel] = useState(alarm.label || '');
    const [file, setFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setH(alarm.h);
            setM(alarm.m);
            setS(alarm.s || 0);
            setLabel(alarm.label || '');
            setFile(null);
        }
    }, [isOpen, alarm]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return;

        let audioId = alarm.audioId;
        let audioName = alarm.audioName;

        if (file) {
            try {
                setUploading(true);
                const saved = await API.uploadAudio(file);
                audioId = saved.id;
                audioName = file.name;
            } catch (e: unknown) {
                console.error('Upload failed', e);
                const msg = e instanceof Error ? e.message : String(e);
                alert(`Failed to upload audio: ${msg}`);
                setUploading(false);
                return;
            } finally {
                setUploading(false);
            }
        }

        await onUpdate(alarm.id, { h, m, s, label, audioId, audioName });
        onClose();
    };

    const isValid = !isNaN(h) && !isNaN(m) && !isNaN(s);

    return (
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
                                {/* Hours */}
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
                                        onChange={e => setH(parseInt(e.target.value) || 0)}
                                        className="w-full bg-bg border border-line rounded-lg p-3 text-center text-2xl font-bold focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                                    />
                                </div>

                                {/* Minutes */}
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
                                        onChange={e => setM(parseInt(e.target.value) || 0)}
                                        className="w-full bg-bg border border-line rounded-lg p-3 text-center text-2xl font-bold focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                                    />
                                </div>

                                {/* Seconds */}
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
                                        onChange={e => setS(parseInt(e.target.value) || 0)}
                                        className="w-full bg-bg border border-line rounded-lg p-3 text-center text-2xl font-bold focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Audio File Input */}
                    <div>
                        <label htmlFor="edit-audio-file" className="block text-sm font-bold text-muted mb-2 uppercase tracking-wider">
                            Audio File
                        </label>
                        <div className="relative">
                            <input
                                id="edit-audio-file"
                                type="file"
                                accept="audio/*"
                                ref={fileInputRef}
                                onChange={e => setFile(e.target.files?.[0] || null)}
                                className="block w-full text-sm text-muted file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border file:border-line file:text-sm file:font-semibold file:bg-bg-soft file:text-fg hover:file:bg-bg-soft/80 cursor-pointer transition-all"
                            />
                            {(file || alarm.audioName) && (
                                <div className="mt-2 text-xs text-muted/70 flex items-center gap-2">
                                    <span className="inline-block w-2 h-2 bg-primary rounded-full"></span>
                                    Selected: {file ? file.name : alarm.audioName}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Label Input */}
                    <div>
                        <label htmlFor="edit-alarm-label" className="block text-sm font-bold text-muted mb-2 uppercase tracking-wider">
                            Label <span className="text-muted/50 font-normal">(Optional)</span>
                        </label>
                        <input
                            id="edit-alarm-label"
                            type="text"
                            placeholder="e.g., Meeting, Wake up, Break time..."
                            className="w-full bg-bg-soft border border-line rounded-xl p-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                            value={label}
                            onChange={e => setLabel(e.target.value)}
                        />
                    </div>

                    {/* Action Buttons */}
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
                            disabled={!isValid || uploading}
                            className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40"
                        >
                            {uploading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
