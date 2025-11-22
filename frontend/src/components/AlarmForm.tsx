import React, { useState, useRef } from 'react';
import { useAlarms } from '../hooks/useAlarms';
import * as API from '../services/api';

export function AlarmForm() {
    const { addItem } = useAlarms();
    const [h, setH] = useState(new Date().getHours());
    const [m, setM] = useState(new Date().getMinutes());
    const [s, setS] = useState(0);
    const [label, setLabel] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return;

        let audioId = null;
        let audioName = '';

        if (file) {
            try {
                setUploading(true);
                const saved = await API.uploadAudio(file);
                audioId = saved.id;
                audioName = file.name;
            } catch (e: any) {
                console.error('Upload failed', e);
                alert(`Failed to upload audio: ${e.message}`);
                setUploading(false);
                return;
            } finally {
                setUploading(false);
            }
        }

        await addItem(h, m, s, label, audioId, audioName);

        // Show success feedback
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);

        // Reset form
        setLabel('');
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const isValid = !isNaN(h) && !isNaN(m) && !isNaN(s);

    return (
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
                            <label htmlFor="hours" className="text-xs font-semibold text-muted/70 mb-1 text-center uppercase tracking-wide">
                                Hours
                            </label>
                            <input
                                id="hours"
                                type="number"
                                min="0"
                                max="23"
                                value={h}
                                onChange={e => setH(parseInt(e.target.value) || 0)}
                                className="w-full bg-bg border border-line rounded-lg p-3 text-center text-2xl font-bold focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                                aria-label="Hours"
                            />
                        </div>

                        {/* Minutes */}
                        <div className="flex flex-col">
                            <label htmlFor="minutes" className="text-xs font-semibold text-muted/70 mb-1 text-center uppercase tracking-wide">
                                Minutes
                            </label>
                            <input
                                id="minutes"
                                type="number"
                                min="0"
                                max="59"
                                value={m}
                                onChange={e => setM(parseInt(e.target.value) || 0)}
                                className="w-full bg-bg border border-line rounded-lg p-3 text-center text-2xl font-bold focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                                aria-label="Minutes"
                            />
                        </div>

                        {/* Seconds */}
                        <div className="flex flex-col">
                            <label htmlFor="seconds" className="text-xs font-semibold text-muted/70 mb-1 text-center uppercase tracking-wide">
                                Seconds
                            </label>
                            <input
                                id="seconds"
                                type="number"
                                min="0"
                                max="59"
                                value={s}
                                onChange={e => setS(parseInt(e.target.value) || 0)}
                                className="w-full bg-bg border border-line rounded-lg p-3 text-center text-2xl font-bold focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                                aria-label="Seconds"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Audio File Input */}
            <div>
                <label htmlFor="audio-file" className="block text-sm font-bold text-muted mb-2 uppercase tracking-wider">
                    Audio File
                </label>
                <div className="relative">
                    <input
                        id="audio-file"
                        type="file"
                        accept="audio/*"
                        ref={fileInputRef}
                        onChange={e => setFile(e.target.files?.[0] || null)}
                        className="block w-full text-sm text-muted file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border file:border-line file:text-sm file:font-semibold file:bg-bg-soft file:text-fg hover:file:bg-bg-soft/80 cursor-pointer transition-all"
                        aria-label="Select audio file"
                    />
                    {file && (
                        <div className="mt-2 text-xs text-muted/70 flex items-center gap-2">
                            <span className="inline-block w-2 h-2 bg-primary rounded-full"></span>
                            Selected: {file.name}
                        </div>
                    )}
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
                    aria-label="Alarm label"
                />
            </div>

            {/* Submit Button */}
            <button
                type="submit"
                disabled={!isValid || uploading}
                className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-xl transition-all transform active:scale-[0.98] shadow-lg shadow-primary/25 hover:shadow-primary/40 disabled:shadow-none flex items-center justify-center gap-2"
                aria-label={uploading ? 'Uploading audio file' : 'Add alarm'}
            >
                {uploading ? (
                    <>
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Uploading...
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
    );
}
