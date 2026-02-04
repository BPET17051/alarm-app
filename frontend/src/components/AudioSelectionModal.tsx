import React, { useState, useEffect, useRef } from 'react';
import * as API from '../services/api';

export type AudioSelection =
    | { source: 'upload'; file: File; name: string }
    | { source: 'select'; id: string; name: string };

interface AudioSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (selection: AudioSelection) => void;
    currentSelection?: AudioSelection | null;
}

export function AudioSelectionModal({ isOpen, onClose, onConfirm, currentSelection }: AudioSelectionModalProps) {
    const [activeTab, setActiveTab] = useState<'upload' | 'select'>('select');
    const [audioFiles, setAudioFiles] = useState<{ id: string; name: string; url: string }[]>([]);
    const [isLoadingAudio, setIsLoadingAudio] = useState(false);

    // Selection state within modal
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectedName, setSelectedName] = useState<string>('');
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadName, setUploadName] = useState<string>('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initialize state from props when opening
    useEffect(() => {
        if (isOpen) {
            if (currentSelection?.source === 'upload') {
                setActiveTab('upload');
                setUploadFile(currentSelection.file);
                setUploadName(currentSelection.name);
            } else if (currentSelection?.source === 'select') {
                setActiveTab('select');
                setSelectedId(currentSelection.id);
                setSelectedName(currentSelection.name);
            } else {
                // Default to select tab if nothing selected, or keep previous logic?
                // Let's default to 'select'
                setActiveTab('select');
            }
            loadAudioFiles();
        }
    }, [isOpen, currentSelection]);

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

    const handleDeleteAudio = async (e: React.MouseEvent, fileId: string) => {
        e.stopPropagation();

        // Find the display name for confirmation message
        const audioFile = audioFiles.find(f => f.id === fileId);
        const displayName = audioFile?.name || fileId;

        if (!confirm(`Are you sure you want to delete "${displayName}"?`)) return;

        try {
            await API.deleteAudio(fileId);
            loadAudioFiles(); // Refresh list
            if (selectedId === fileId) {
                setSelectedId(null);
                setSelectedName('');
            }
        } catch (error) {
            console.error('Failed to delete audio', error);
            alert('Failed to delete audio file');
        }
    };

    const handleConfirm = () => {
        if (activeTab === 'upload' && uploadFile) {
            onConfirm({
                source: 'upload',
                file: uploadFile,
                name: uploadName || uploadFile.name
            });
            onClose();
        } else if (activeTab === 'select' && selectedId) {
            onConfirm({
                source: 'select',
                id: selectedId,
                name: selectedName
            });
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-bg border border-line rounded-2xl w-full max-w-md shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-muted hover:text-fg transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <h2 className="text-xl font-bold mb-6">Choose Audio Source</h2>

                {/* Tabs */}
                <div className="bg-bg-soft/50 border border-line rounded-xl p-1 flex mb-6">
                    <button
                        type="button"
                        onClick={() => setActiveTab('select')}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'select' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted hover:text-fg'}`}
                    >
                        Select Existing
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('upload')}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'upload' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted hover:text-fg'}`}
                    >
                        Upload New
                    </button>
                </div>

                {/* Content */}
                <div className="min-h-[200px]">
                    {activeTab === 'select' ? (
                        <div className="space-y-4">
                            {isLoadingAudio ? (
                                <div className="text-center py-8 text-muted text-sm">Loading audio files...</div>
                            ) : audioFiles.length === 0 ? (
                                <div className="text-center py-8 text-muted text-sm border border-dashed border-line rounded-lg">
                                    No audio files found.
                                </div>
                            ) : (
                                <div className="border border-line rounded-lg max-h-60 overflow-y-auto bg-bg-soft/30 p-2 space-y-1 custom-scrollbar">
                                    {audioFiles.map(audio => (
                                        <div
                                            key={audio.id}
                                            onClick={() => {
                                                setSelectedId(audio.id);
                                                setSelectedName(audio.name);
                                            }}
                                            className={`p-3 rounded-lg cursor-pointer text-sm flex items-center justify-between group transition-colors ${selectedId === audio.id ? 'bg-primary/20 text-primary border border-primary/30' : 'hover:bg-bg-soft text-muted hover:text-fg border border-transparent'}`}
                                        >
                                            <div className="flex items-center gap-3 truncate overflow-hidden flex-1">
                                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                                </svg>
                                                <span className="truncate">{audio.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {selectedId === audio.id && (
                                                    <svg className="w-5 h-5 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleDeleteAudio(e, audio.id)}
                                                    className="p-1.5 hover:bg-red-500/20 text-muted hover:text-red-500 rounded transition-all"
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
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div
                                className="border-2 border-dashed border-line rounded-xl p-8 text-center hover:bg-bg-soft/30 transition-colors cursor-pointer"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    id="audio-file"
                                    type="file"
                                    accept="audio/*"
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={e => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            setUploadFile(file);
                                            const name = file.name.replace(/\.[^/.]+$/, "");
                                            setUploadName(name);
                                        }
                                    }}
                                />
                                {uploadFile ? (
                                    <div className="text-primary font-bold flex flex-col items-center gap-2">
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                        </svg>
                                        <div className="truncate max-w-[200px]">{uploadFile.name}</div>
                                        <span className="text-xs text-muted font-normal">Click to change</span>
                                    </div>
                                ) : (
                                    <div className="text-muted flex flex-col items-center gap-2">
                                        <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                        <span>Click to browse audio file</span>
                                    </div>
                                )}
                            </div>

                            {uploadFile && (
                                <div>
                                    <label htmlFor="audio-name" className="block text-xs font-bold text-muted mb-1 uppercase tracking-wider">
                                        Rename File <span className="text-muted/50 font-normal">(Optional)</span>
                                    </label>
                                    <input
                                        id="audio-name"
                                        type="text"
                                        value={uploadName}
                                        onChange={e => setUploadName(e.target.value)}
                                        placeholder="e.g. MorningAlert"
                                        className="w-full bg-bg-soft border border-line rounded-lg p-3 text-sm outline-none focus:border-primary transition-all"
                                    />
                                    <p className="text-xs text-muted/50 mt-2">
                                        Extension will be added automatically. Existing files with same name will be overwritten.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="mt-8 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-bold text-muted hover:text-fg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={activeTab === 'upload' ? !uploadFile : !selectedId}
                        className="bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold px-6 py-2 rounded-xl shadow-lg shadow-primary/25 transition-all transform active:scale-[0.98]"
                    >
                        Confirm Selection
                    </button>
                </div>
            </div>
        </div>
    );
}
