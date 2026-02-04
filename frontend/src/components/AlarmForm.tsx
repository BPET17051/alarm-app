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
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // New state for audio management
    const [audioSource, setAudioSource] = useState<'upload' | 'select'>('upload');
    const [audioFiles, setAudioFiles] = useState<{ id: string; name: string; url: string }[]>([]);
    const [isLoadingAudio, setIsLoadingAudio] = useState(false);
    const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null);
    const [selectedAudioName, setSelectedAudioName] = useState<string>('');

    const loadAudioFiles = async () => {
        setIsLoadingAudio(true);
        try {
            const files = await API.getAudioFiles();
            setAudioFiles(files);
        } catch (e) {
            console.error('Failed to load audio files', e);
        } finally {
            setIsLoadingAudio(false);
        }
    };

    // Load audio files when switching to select mode, or just rely on manual refresh/click
    // Better to load when the component mounts if we want it ready? 
    // Or just load when user clicks "Select Existing" (handled in the button click)

    const handleDeleteAudio = async (e: React.MouseEvent, fileName: string) => {
        e.stopPropagation();
        if (!confirm(`Are you sure you want to delete "${fileName}"?`)) return;

        try {
            await API.deleteAudio(fileName);
            // Refresh list
            loadAudioFiles();
            // Deselect if deleted
            if (selectedAudioId === fileName) {
                setSelectedAudioId(null);
                setSelectedAudioName('');
            }
        } catch (error: unknown) {
            console.error('Failed to delete audio', error);
            alert('Failed to delete audio file');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return;

        setIsSubmitting(true);

        try {
            let audioId = null;
            let audioName = '';

            if (audioSource === 'upload' && file) {
                const saved = await API.uploadAudio(file, selectedAudioName);
                audioId = saved.id;
                audioName = saved.name || file.name; // Use backend name if available to be safe
            } else if (audioSource === 'select' && selectedAudioId) {
                audioId = selectedAudioId;
                audioName = selectedAudioName;
            }

            await addItem(h, m, s, label, audioId, audioName);

            // Show success feedback
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);

            // Reset form
            setLabel('');
            setFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            // Don't reset audioSource to keep user preference? Or reset to upload?
            // Let's keep it as is, but maybe clear selection
            setSelectedAudioId(null);
            setSelectedAudioName('');

        } catch (e: unknown) {
            console.error('Operation failed', e);
            const msg = e instanceof Error ? e.message : String(e);
            alert(`Failed: ${msg}`);
        } finally {
            setIsSubmitting(false);
        }
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

            {/* Audio Selection Section */}
            <div>
                <label className="block text-sm font-bold text-muted mb-3 uppercase tracking-wider">
                    Audio Source
                </label>

                <div className="bg-bg-soft/30 border border-line rounded-xl p-1 flex mb-4">
                    <button
                        type="button"
                        onClick={() => setAudioSource('upload')}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${audioSource === 'upload' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted hover:text-fg'}`}
                    >
                        Upload New
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setAudioSource('select');
                            loadAudioFiles();
                        }}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${audioSource === 'select' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted hover:text-fg'}`}
                    >
                        Select Existing
                    </button>
                </div>

                {audioSource === 'upload' ? (
                    <div className="relative animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <input
                            id="audio-file"
                            type="file"
                            accept="audio/*"
                            ref={fileInputRef}
                            onChange={e => {
                                setFile(e.target.files?.[0] || null);
                                setSelectedAudioId(null); // Clear selection if uploading
                                // Pre-fill name from file
                                if (e.target.files?.[0]) {
                                    const name = e.target.files[0].name.replace(/\.[^/.]+$/, "");
                                    setSelectedAudioName(name);
                                }
                            }}
                            className="block w-full text-sm text-muted file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border file:border-line file:text-sm file:font-semibold file:bg-bg-soft file:text-fg hover:file:bg-bg-soft/80 cursor-pointer transition-all"
                            aria-label="Select audio file"
                        />
                        {file && (
                            <div className="mt-4 space-y-2">
                                <div className="text-xs text-muted/70 flex items-center gap-2">
                                    <span className="inline-block w-2 h-2 bg-primary rounded-full"></span>
                                    Selected: {file.name}
                                </div>

                                <div>
                                    <label htmlFor="audio-name" className="block text-xs font-bold text-muted mb-1 uppercase tracking-wider">
                                        Rename File <span className="text-muted/50 font-normal">(Optional, extension added automatically)</span>
                                    </label>
                                    <input
                                        id="audio-name"
                                        type="text"
                                        value={selectedAudioName}
                                        onChange={e => setSelectedAudioName(e.target.value)}
                                        placeholder="e.g. MorningAlert"
                                        className="w-full bg-bg-soft border border-line rounded-lg p-2 text-sm outline-none focus:border-primary transition-all"
                                    />
                                </div>
                            </div>
                        )}
                        <p className="text-xs text-muted/50 mt-2 ml-1">
                            New uploads will use their filename. If a file with the same name exists, it will be overwritten.
                        </p>
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {isLoadingAudio ? (
                            <div className="text-center py-4 text-muted text-sm">Loading audio files...</div>
                        ) : audioFiles.length === 0 ? (
                            <div className="text-center py-4 text-muted text-sm border border-dashed border-line rounded-lg">
                                No audio files found.
                            </div>
                        ) : (
                            <div className="border border-line rounded-lg max-h-48 overflow-y-auto bg-bg-soft/30 p-2 space-y-1 custom-scrollbar">
                                {audioFiles.map(audio => (
                                    <div
                                        key={audio.id}
                                        onClick={() => {
                                            setSelectedAudioId(audio.id);
                                            setFile(null); // Clear file if selecting
                                            setSelectedAudioName(audio.name);
                                        }}
                                        className={`p-2 rounded-lg cursor-pointer text-sm flex items-center justify-between group transition-colors ${selectedAudioId === audio.id ? 'bg-primary/20 text-primary border border-primary/30' : 'hover:bg-bg-soft text-muted hover:text-fg border border-transparent'}`}
                                    >
                                        <div className="flex items-center gap-2 truncate overflow-hidden flex-1">
                                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                            </svg>
                                            <span className="truncate">{audio.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {selectedAudioId === audio.id && (
                                                <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                            <button
                                                type="button"
                                                onClick={(e) => handleDeleteAudio(e, audio.name)}
                                                className="p-1 hover:bg-red-500/20 text-muted hover:text-red-500 rounded transition-all"
                                                title="Delete file"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="mt-2 text-right">
                            <button type="button" onClick={loadAudioFiles} className="text-xs text-primary hover:text-primary/80 underline">Refresh List</button>
                        </div>
                    </div>
                )}
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
                disabled={!isValid || isSubmitting}
                className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-xl transition-all transform active:scale-[0.98] shadow-lg shadow-primary/25 hover:shadow-primary/40 disabled:shadow-none flex items-center justify-center gap-2"
                aria-label={isSubmitting ? 'Saving alarm...' : 'Add alarm'}
            >
                {isSubmitting ? (
                    <>
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {file ? 'Uploading & Saving...' : 'Saving...'}
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
                        {audioSource === 'upload' && file ? 'Upload & Add Alarm' : 'Add Alarm'}
                    </>
                )}
            </button>
        </form>
    );
}
