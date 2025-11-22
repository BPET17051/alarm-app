import { useState } from 'react';
import { Layout } from '../components/Layout';
import { useAlarms } from '../hooks/useAlarms';
import { useScheduler } from '../hooks/useScheduler';
import { Clock } from '../components/Clock';
import { AlarmForm } from '../components/AlarmForm';
import { AlarmList } from '../components/AlarmList';
import { Controls } from '../components/Controls';

export function Home() {
    const { items, playedIds, markPlayed } = useAlarms();
    useScheduler(items, playedIds, markPlayed);
    const [selected, setSelected] = useState<Set<string>>(new Set());

    return (
        <Layout>
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
