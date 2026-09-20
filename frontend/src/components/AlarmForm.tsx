import React, { useState } from 'react';
import { useAlarms } from '../hooks/useAlarms';
import * as API from '../services/api';
import { AudioSelectionModal } from './AudioSelectionModal';
import type { AudioSelection } from './AudioSelectionModal';
import { normalizeTime } from '../utils/time';
import { sanitizeAudioDisplayName } from '../utils/audio';

export function AlarmForm() {
    const { addItem, armAudio } = useAlarms();
    const [h, setH] = useState(new Date().getHours());
    const [m, setM] = useState(new Date().getMinutes());
    const [s, setS] = useState(0);

    // Audio selection state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [audioSelection, setAudioSelection] = useState<AudioSelection | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        setIsSubmitting(true);
        void armAudio();

        try {
            let audioId = null;
            let audioDisplayName = '';

            if (audioSelection?.source === 'upload') {
                const saved = await API.uploadAudio(audioSelection.file, audioSelection.displayName);
                audioId = saved.id;
                audioDisplayName = sanitizeAudioDisplayName(saved.displayName || audioSelection.displayName);
            } else if (audioSelection?.source === 'select') {
                audioId = audioSelection.id;
                audioDisplayName = sanitizeAudioDisplayName(audioSelection.displayName);
            }

            const nextTime = normalizeTime(h, m, s);

            await addItem(nextTime.h, nextTime.m, nextTime.s, audioId, audioDisplayName);

            // Show success feedback
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);

            // Reset form
            setAudioSelection(null);

        } catch (e: unknown) {
            console.error('Operation failed', e);
            const msg = e instanceof Error ? e.message : String(e);
            alert(`บันทึกไม่สำเร็จ: ${msg}`);
        } finally {
            setIsSubmitting(false);
        }
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
        if (!audioSelection) return 'เสียงเตือนมาตรฐาน';
        if (audioSelection.source === 'upload') {
            return `อัปโหลด: ${audioSelection.displayName || audioSelection.file.name}`;
        }
        return `เลือกแล้ว: ${audioSelection.displayName}`;
    };

    return (
        <>
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Time Input Section */}
                <div>
                    <h3 className="block text-sm font-bold text-muted mb-2 tracking-wider">
                        ขั้นที่ 1 · ตั้งเวลา
                    </h3>
                    <div className="bg-bg-soft/50 border border-line/50 rounded-xl p-3">
                        <div className="grid grid-cols-3 gap-3">
                            <div className="flex flex-col">
                                <label htmlFor="hours" className="text-xs font-semibold text-muted/70 mb-1 text-center uppercase tracking-wide">ชั่วโมง</label>
                                <input
                                    id="hours" type="number" min="0" max="23" value={h}
                                    onChange={e => handleTimeChange('h', e.target.value)}
                                    className="w-full bg-bg border border-line rounded-lg p-2 text-center text-xl font-bold focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                                />
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="minutes" className="text-xs font-semibold text-muted/70 mb-1 text-center uppercase tracking-wide">นาที</label>
                                <input
                                    id="minutes" type="number" min="0" max="59" value={m}
                                    onChange={e => handleTimeChange('m', e.target.value)}
                                    className="w-full bg-bg border border-line rounded-lg p-2 text-center text-xl font-bold focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                                />
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="seconds" className="text-xs font-semibold text-muted/70 mb-1 text-center uppercase tracking-wide">วินาที</label>
                                <input
                                    id="seconds" type="number" min="0" max="59" value={s}
                                    onChange={e => handleTimeChange('s', e.target.value)}
                                    className="w-full bg-bg border border-line rounded-lg p-2 text-center text-xl font-bold focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Audio Source Trigger */}
                <div>
                    <h3 className="block text-sm font-bold text-muted mb-2 tracking-wider">
                        ขั้นที่ 2 · เลือกไฟล์เสียง
                    </h3>

                    <div
                        onClick={() => setIsModalOpen(true)}
                        className="bg-bg-soft/30 border border-line rounded-xl p-3 cursor-pointer hover:bg-bg-soft/50 hover:border-primary/50 transition-all group"
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
                                        {audioSelection ? (audioSelection.source === 'upload' ? 'พร้อมอัปโหลดเมื่อกดเพิ่ม' : 'เลือกจากคลังเสียงแล้ว') : 'กดเพื่อเลือกไฟล์เสียง'}
                                    </span>
                                </div>
                            </div>
                            <svg className="w-5 h-5 text-muted group-hover:text-primary transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Submit Button */}
                <h3 className="text-sm font-bold text-muted tracking-wider -mb-3">
                    ขั้นที่ 3 · เพิ่มเข้าตารางประกาศ
                </h3>
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
                            กำลังบันทึก...
                        </>
                    ) : showSuccess ? (
                        <>
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            เพิ่มแล้ว!
                        </>
                    ) : (
                        <>
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                            </svg>
                            เพิ่มรายการประกาศ
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
