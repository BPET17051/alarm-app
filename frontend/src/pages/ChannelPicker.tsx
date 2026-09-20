import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { useChannel } from '../context/ChannelContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { Channel } from '../types';

const POLL_INTERVAL_MS = 4000;

export function ChannelPicker() {
    const { channels, channelsStatus, notice, refreshChannels, retryChannels, selectChannel, createChannel, deleteChannel } = useChannel();
    const [newName, setNewName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<Channel | null>(null);

    useEffect(() => {
        void refreshChannels();
        const interval = window.setInterval(() => void refreshChannels(), POLL_INTERVAL_MS);
        return () => window.clearInterval(interval);
    }, [refreshChannels]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const name = newName.trim();
        if (!name) return;
        setIsCreating(true);
        const created = await createChannel(name);
        setIsCreating(false);
        if (created) setNewName('');
    };

    return (
        <Layout>
            <div className="max-w-2xl mx-auto bg-card/90 backdrop-blur-md border border-line rounded-2xl p-6 xl:p-8 shadow-2xl space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">เลือกคอร์ส / ช่องประกาศ</h1>
                    <p className="text-sm text-muted mt-1">
                        เมื่อเลือกแล้วเครื่องนี้จะถูกล็อกไว้กับช่องนั้น และเครื่องอื่นจะเลือกช่องเดียวกันไม่ได้ จนกว่าจะกด &quot;ออกจากช่องนี้&quot;
                    </p>
                    <p className="text-sm text-muted mt-1">
                        หากเครื่องดับหรือเน็ตหลุด ช่องจะว่างอีกครั้งภายในประมาณ 30 วินาที
                    </p>
                </div>

                {notice && (
                    <div role="alert" className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">
                        {notice}
                    </div>
                )}

                {channelsStatus === 'error' && (
                    <div role="alert" className="rounded-lg border border-danger/50 bg-danger/10 px-4 py-3">
                        <div className="font-semibold text-danger">
                            โหลดรายการช่องไม่สำเร็จ{channels.length > 0 ? ' — ข้อมูลที่เห็นอาจไม่ล่าสุด' : ''}
                        </div>
                        <div className="text-sm text-muted mt-1">
                            เซิร์ฟเวอร์อาจกำลังเริ่มทำงานหรือเน็ตมีปัญหา ระบบจะลองใหม่เองทุก 4 วินาที อย่าเพิ่งสร้างช่องใหม่
                        </div>
                        <button
                            type="button"
                            onClick={() => void retryChannels()}
                            className="mt-3 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-semibold"
                        >
                            ลองใหม่
                        </button>
                    </div>
                )}

                <ul className="space-y-3" aria-label="รายการช่อง">
                    {channelsStatus === 'loading' && channels.length === 0 && (
                        <li role="status" className="text-sm text-muted">กำลังโหลดรายการช่อง...</li>
                    )}
                    {channelsStatus === 'ready' && channels.length === 0 && (
                        <li className="text-sm text-muted">ยังไม่มีช่อง สร้างช่องแรกด้านล่าง</li>
                    )}
                    {channels.map((channel) => (
                        <li
                            key={channel.id}
                            className="flex items-center justify-between gap-3 bg-bg-soft/40 border border-line rounded-xl px-4 py-3"
                        >
                            <div className="min-w-0">
                                <div className="font-semibold truncate">{channel.name}</div>
                                <div className={`text-xs ${channel.locked ? 'text-amber-300' : 'text-green-400'}`}>
                                    {channel.locked ? 'มีเครื่องอื่นใช้อยู่ — เลือกไม่ได้ตอนนี้' : 'ว่าง — กดเลือกเพื่อเริ่มใช้งาน'}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => void selectChannel(channel)}
                                    disabled={channel.locked}
                                    className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold"
                                >
                                    เลือก
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPendingDelete(channel)}
                                    disabled={channel.locked}
                                    className="px-3 py-2 rounded-lg border border-line text-muted hover:text-fg disabled:opacity-40 disabled:cursor-not-allowed"
                                    aria-label={`ลบช่อง ${channel.name}`}
                                >
                                    ลบ
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>

                <form onSubmit={handleCreate} className="flex gap-3">
                    <label htmlFor="new-channel-name" className="sr-only">ชื่อช่องใหม่</label>
                    <input
                        id="new-channel-name"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        maxLength={60}
                        placeholder="ชื่อคอร์ส / ช่องใหม่"
                        className="flex-1 bg-bg border border-line rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                        type="submit"
                        disabled={isCreating || channelsStatus !== 'ready' || !newName.trim()}
                        className="px-5 py-3 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-bold"
                    >
                        สร้างช่อง
                    </button>
                </form>
            </div>

            <ConfirmDialog
                open={pendingDelete !== null}
                title={`ลบช่อง "${pendingDelete?.name ?? ''}" ?`}
                description="ช่องนี้จะถูกลบถาวร ลบได้เฉพาะช่องที่ว่างและไม่มีรายการประกาศเหลืออยู่"
                confirmLabel="ลบช่อง"
                onCancel={() => setPendingDelete(null)}
                onConfirm={() => {
                    const channel = pendingDelete;
                    setPendingDelete(null);
                    if (channel) void deleteChannel(channel);
                }}
            />
        </Layout>
    );
}
