import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { useAlarms } from '../hooks/useAlarms';
import { useScheduler } from '../hooks/useScheduler';
import { useTimeSync } from '../hooks/useTimeSync';
import { Clock } from '../components/Clock';
import { AlarmForm } from '../components/AlarmForm';
import { AlarmList } from '../components/AlarmList';
import { Controls } from '../components/Controls';
import { formatDayKey } from '../utils/date';
import type { AudioTestLanguage } from '../services/audioTest';

export function Home() {
    const { items, playedIds, markPlayed, isAudioEnabled, testAudio, syncPlaybackDay } = useAlarms();
    const { serverTime, offset, isSyncing, error } = useTimeSync();
    const dayKey = formatDayKey(serverTime);
    const [selectedLanguage, setSelectedLanguage] = useState<AudioTestLanguage>('th');
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'fallback' | 'failed'>(isAudioEnabled ? 'success' : 'idle');

    useEffect(() => {
        syncPlaybackDay(dayKey);
    }, [dayKey, syncPlaybackDay]);

    useEffect(() => {
        if (isAudioEnabled && testStatus === 'idle') {
            setTestStatus('success');
        }
    }, [isAudioEnabled, testStatus]);

    useScheduler(items, playedIds, markPlayed, isAudioEnabled, dayKey, serverTime);
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const handleTestAudio = async () => {
        setTestStatus('testing');
        try {
            const result = await testAudio(selectedLanguage);
            setTestStatus(result.mode === 'beep' ? 'fallback' : 'success');
        } catch {
            setTestStatus('failed');
        }
    };

    let audioStatusText = 'กดทดสอบเสียง';
    let audioStatusClass = 'text-amber-400/80';

    if (testStatus === 'testing') {
        audioStatusText = 'กำลังทดสอบเสียง...';
        audioStatusClass = 'text-sky-300';
    } else if (testStatus === 'success') {
        audioStatusText = 'ระบบเสียงพร้อมใช้งาน';
        audioStatusClass = 'text-green-400';
    } else if (testStatus === 'fallback') {
        audioStatusText = 'ทดสอบด้วยเสียงแจ้งเตือนแทนข้อความ';
        audioStatusClass = 'text-amber-300';
    } else if (testStatus === 'failed') {
        audioStatusText = 'ทดสอบเสียงไม่สำเร็จ';
        audioStatusClass = 'text-red-400';
    }

    return (
        <Layout>
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 xl:gap-8">
                <section className="xl:col-span-5 space-y-6">
                    <div className="bg-card/90 backdrop-blur-md border border-line rounded-2xl p-6 xl:p-8 shadow-2xl">
                        <Clock serverTime={serverTime} offset={offset} isSyncing={isSyncing} error={error} />
                        <div className="my-6 border-t border-line/50"></div>
                        <AlarmForm />
                    </div>
                </section>

                <section className="xl:col-span-7">
                    <div className="bg-card/90 backdrop-blur-md border border-line rounded-2xl p-6 xl:p-8 shadow-2xl min-h-[500px] flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-muted flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                                </svg>
                                Scheduled Alarms
                            </h2>
                            <div className="flex items-center gap-3 flex-wrap justify-end">
                                <button
                                    type="button"
                                    onClick={handleTestAudio}
                                    disabled={testStatus === 'testing'}
                                    className="px-4 py-2 rounded-lg transition-colors bg-primary hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold shadow-lg shadow-primary/20"
                                    title="Test alarm audio"
                                    aria-label="Test alarm audio"
                                >
                                    {testStatus === 'testing' ? 'กำลังทดสอบ...' : 'ทดสอบเสียง'}
                                </button>
                                <div className="flex items-center bg-bg-soft/60 border border-line rounded-lg p-1">
                                    {(['th', 'en'] as AudioTestLanguage[]).map((language) => (
                                        <button
                                            key={language}
                                            type="button"
                                            onClick={() => setSelectedLanguage(language)}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${selectedLanguage === language
                                                ? 'bg-line text-white'
                                                : 'text-muted hover:text-fg'}`}
                                            aria-pressed={selectedLanguage === language}
                                        >
                                            {language.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                                <span className={`text-xs sm:text-sm ${audioStatusClass}`}>{audioStatusText}</span>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <AlarmList selected={selected} onSelect={setSelected} />
                        </div>
                        <Controls selected={selected} />
                    </div>
                </section>
            </div>
        </Layout>
    );
}
