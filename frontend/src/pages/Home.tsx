import { useState } from 'react';
import { Layout } from '../components/Layout';
import { useAlarms } from '../hooks/useAlarms';
import { useScheduler } from '../hooks/useScheduler';
import { Clock } from '../components/Clock';
import { AlarmForm } from '../components/AlarmForm';
import { AlarmList } from '../components/AlarmList';
import { Controls } from '../components/Controls';

export function Home() {
    const { items, playedIds, markPlayed, isAudioEnabled, enableAudio, disableAudio } = useAlarms();
    useScheduler(items, playedIds, markPlayed, isAudioEnabled);
    const [selected, setSelected] = useState<Set<string>>(new Set());

    return (
        <Layout>
            <div className="mb-6 bg-card/90 backdrop-blur-md border border-line rounded-2xl p-4 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${isAudioEnabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {isAudioEnabled ? (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            </svg>
                        ) : (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                            </svg>
                        )}
                    </div>
                    <div>
                        <h3 className="font-semibold text-fg">Audio Status</h3>
                        <p className="text-sm text-muted">{isAudioEnabled ? 'Audio is enabled' : 'Audio is disabled'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => enableAudio()}
                        disabled={isAudioEnabled}
                        className={`p-2 rounded-lg transition-colors ${isAudioEnabled
                            ? 'bg-green-500/20 text-green-400 cursor-default'
                            : 'bg-line hover:bg-line/80 text-muted hover:text-fg'}`}
                        title="Enable Audio"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        </svg>
                    </button>
                    <button
                        onClick={() => disableAudio()}
                        disabled={!isAudioEnabled}
                        className={`p-2 rounded-lg transition-colors ${!isAudioEnabled
                            ? 'bg-red-500/20 text-red-400 cursor-default'
                            : 'bg-line hover:bg-line/80 text-muted hover:text-fg'}`}
                        title="Disable Audio"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                        </svg>
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
                {/* Left Column: Clock & Form */}
                <section className="lg:col-span-5 space-y-6">
                    <div className="bg-card/90 backdrop-blur-md border border-line rounded-2xl p-6 lg:p-8 shadow-2xl">
                        <Clock />
                        <div className="my-6 border-t border-line/50"></div>
                        <AlarmForm />
                    </div>
                </section>

                {/* Right Column: List */}
                <section className="lg:col-span-7">
                    <div className="bg-card/90 backdrop-blur-md border border-line rounded-2xl p-6 lg:p-8 shadow-2xl min-h-[500px] flex flex-col">
                        <h2 className="text-xl font-bold mb-4 text-muted flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                            </svg>
                            Scheduled Alarms
                        </h2>
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
