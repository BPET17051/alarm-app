import { useEffect, useState } from 'react';
import { useChannel } from '../context/ChannelContext';
import { Layout } from '../components/Layout';
import { useAlarms } from '../hooks/useAlarms';
import { useScheduler } from '../hooks/useScheduler';
import { useTimeSync } from '../hooks/useTimeSync';
import { Clock } from '../components/Clock';
import { AlarmForm } from '../components/AlarmForm';
import { AlarmList } from '../components/AlarmList';
import { Controls } from '../components/Controls';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ReadinessCard } from '../components/ReadinessCard';
import { formatDayKey } from '../utils/date';

export function Home() {
    const { items, playedIds, markPlayed, syncPlaybackDay } = useAlarms();
    const { serverTime, offset, synced, error } = useTimeSync();
    const { session, leaseConfirmed, leaveChannel, renameChannel } = useChannel();
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const [renameError, setRenameError] = useState<string | null>(null);
    const [confirmLeave, setConfirmLeave] = useState(false);
    const dayKey = formatDayKey(serverTime);
    const [selectedState, setSelectedState] = useState<{ dayKey: string; ids: Set<string> }>({
        dayKey,
        ids: new Set()
    });
    const selected = selectedState.dayKey === dayKey ? selectedState.ids : new Set<string>();

    useEffect(() => {
        syncPlaybackDay(dayKey);
    }, [dayKey, syncPlaybackDay]);

    const { playingIds } = useScheduler(items, playedIds, markPlayed, dayKey, serverTime, leaseConfirmed);

    const startRename = () => {
        setRenameValue(session?.name ?? '');
        setRenameError(null);
        setIsRenaming(true);
    };

    const submitRename = async (e: React.FormEvent) => {
        e.preventDefault();
        const name = renameValue.trim();
        if (!name) return;
        const failure = await renameChannel(name);
        if (failure) {
            setRenameError(failure);
            return;
        }
        setIsRenaming(false);
    };

    return (
        <Layout>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 bg-card/90 border border-line rounded-2xl px-5 py-4">
                <div className="min-w-0">
                    <div className="text-xs text-muted tracking-wider">ช่อง / คอร์สที่กำลังใช้งาน</div>
                    {isRenaming ? (
                        <form onSubmit={submitRename} className="flex items-center gap-2 mt-1">
                            <input
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                maxLength={60}
                                aria-label="ชื่อช่อง"
                                className="bg-bg border border-line rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-primary"
                            />
                            <button type="submit" className="px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-semibold">บันทึก</button>
                            <button type="button" onClick={() => setIsRenaming(false)} className="px-3 py-1.5 rounded-lg border border-line text-sm text-muted">ยกเลิก</button>
                        </form>
                    ) : (
                        <div className="flex items-center gap-3">
                            <span className="text-2xl font-bold truncate">{session?.name}</span>
                            <button type="button" onClick={startRename} className="text-xs text-muted hover:text-fg underline">เปลี่ยนชื่อ</button>
                        </div>
                    )}
                    {renameError && <div role="alert" className="text-xs text-amber-300 mt-1">{renameError}</div>}
                    <div
                        role="status"
                        className={`inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-full text-sm font-semibold border ${leaseConfirmed
                            ? 'bg-green-500/10 border-green-500/40 text-green-300'
                            : 'bg-amber-500/10 border-amber-500/40 text-amber-300'}`}
                    >
                        {leaseConfirmed
                            ? '● เครื่องนี้กำลังคุมช่องนี้'
                            : '◐ กำลังยืนยันสิทธิ์ — หยุดเล่นเสียงชั่วคราว'}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setConfirmLeave(true)}
                    className="px-4 py-2 rounded-lg border border-line text-muted hover:text-fg hover:bg-white/5 font-semibold"
                >
                    ออกจากช่องนี้
                </button>
            </div>

            <ConfirmDialog
                open={confirmLeave}
                title={`ออกจากช่อง "${session?.name ?? ''}" ?`}
                description="เครื่องนี้จะหยุดเล่นเสียงตามตารางของช่องนี้ และปลดล็อกให้เครื่องอื่นเลือกช่องนี้ได้"
                confirmLabel="ออกจากช่องและหยุดเสียง"
                onCancel={() => setConfirmLeave(false)}
                onConfirm={() => {
                    setConfirmLeave(false);
                    void leaveChannel();
                }}
            />

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 xl:gap-8">
                <section className="xl:col-span-5 space-y-6">
                    <div className="bg-card/90 backdrop-blur-md border border-line rounded-2xl p-6 xl:p-8 shadow-2xl">
                        <Clock serverTime={serverTime} offset={offset} synced={synced} error={error} />
                        <ReadinessCard serverTime={serverTime} clockReady={synced} />
                        <div className="my-6 border-t border-line/50"></div>
                        <AlarmForm />
                    </div>
                </section>

                <section className="xl:col-span-7">
                    <div className="bg-card/90 backdrop-blur-md border border-line rounded-2xl p-6 xl:p-8 shadow-2xl min-h-[500px] flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-muted flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                                </svg>
                                ตารางประกาศวันนี้
                            </h2>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <AlarmList
                                serverTime={serverTime}
                                playingIds={playingIds}
                                selected={selected}
                                onSelect={(ids) => setSelectedState({ dayKey, ids })}
                            />
                        </div>
                        <Controls selected={selected} />
                    </div>
                </section>
            </div>
        </Layout>
    );
}
