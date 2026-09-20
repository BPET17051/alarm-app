import { useState } from 'react';
import { useAlarms } from '../hooks/useAlarms';
import { useChannel } from '../context/ChannelContext';
import { formatAudioName } from '../utils/audio';
import type { AudioTestLanguage } from '../services/audioTest';

type TestStatus = 'idle' | 'testing' | 'success' | 'fallback' | 'failed';

function formatCountdown(totalSeconds: number) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `อีก ${hours} ชั่วโมง ${minutes} นาที`;
    if (minutes > 0) return `อีก ${minutes} นาที ${seconds} วินาที`;
    return `อีก ${seconds} วินาที`;
}

const pad = (n: number) => n.toString().padStart(2, '0');

export function ReadinessCard({ serverTime, clockReady }: { serverTime: Date; clockReady: boolean }) {
    const { items, playedIds, alarmsStatus, isAudioEnabled, testAudio } = useAlarms();
    const { leaseConfirmed } = useChannel();
    const [language, setLanguage] = useState<AudioTestLanguage>('th');
    const [testStatus, setTestStatus] = useState<TestStatus>('idle');

    const missing: string[] = [];
    if (!leaseConfirmed) missing.push('กำลังยืนยันสิทธิ์ช่อง');
    if (!clockReady) missing.push('นาฬิกายังไม่ซิงก์กับเซิร์ฟเวอร์');
    if (!isAudioEnabled) missing.push('ยังไม่ได้เปิดเสียงของเบราว์เซอร์');
    const ready = missing.length === 0;

    const nowSeconds = serverTime.getHours() * 3600 + serverTime.getMinutes() * 60 + serverTime.getSeconds();
    const next = items
        .filter((item) => item.notify_status === 'PENDING' && !playedIds.has(item.id))
        .map((item) => ({ item, at: item.h * 3600 + item.m * 60 + (item.s || 0) }))
        .filter(({ at }) => at > nowSeconds)
        .sort((a, b) => a.at - b.at)[0];

    let nextLine: string;
    let nextTone = 'text-fg';
    if (alarmsStatus === 'error') {
        nextLine = 'โหลดตารางประกาศไม่สำเร็จ';
        nextTone = 'text-danger';
    } else if (alarmsStatus === 'loading') {
        nextLine = 'กำลังโหลดตารางประกาศ...';
        nextTone = 'text-muted';
    } else if (next) {
        nextLine = `${pad(next.item.h)}:${pad(next.item.m)}:${pad(next.item.s || 0)} · ${formatCountdown(next.at - nowSeconds)} · ${formatAudioName(next.item.audioDisplayName)}`;
    } else {
        nextLine = 'ไม่มีรายการที่รอเล่นในวันนี้';
        nextTone = 'text-muted';
    }

    const handleTest = async () => {
        setTestStatus('testing');
        try {
            const result = await testAudio(language);
            setTestStatus(result.mode === 'beep' ? 'fallback' : 'success');
        } catch {
            setTestStatus('failed');
        }
    };

    const testMessage: Record<TestStatus, string | null> = {
        idle: null,
        testing: 'กำลังทดสอบเสียง...',
        success: 'ทดสอบเสียงสำเร็จ',
        fallback: 'ทดสอบด้วยเสียงแจ้งเตือนแทนข้อความพูด',
        failed: 'ทดสอบเสียงไม่สำเร็จ ตรวจสอบลำโพงและการอนุญาตเสียงของเบราว์เซอร์',
    };

    return (
        <section aria-label="สถานะความพร้อม" className="space-y-3">
            <div
                role="status"
                className={`rounded-xl border px-4 py-3 ${ready
                    ? 'border-green-500/40 bg-green-500/10 text-green-300'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-300'}`}
            >
                <div className="font-bold">
                    {ready ? '✓ พร้อมเล่นเสียงตามเวลา' : '⚠ ยังไม่พร้อมเล่นเสียง'}
                </div>
                {!ready && <div className="text-sm mt-1">{missing.join(' · ')}</div>}
            </div>

            <div className="rounded-xl border border-line bg-bg-soft/40 px-4 py-3">
                <div className="text-xs text-muted uppercase tracking-wider mb-1">รายการถัดไป</div>
                <div className={`font-semibold tabular-nums ${nextTone}`}>{nextLine}</div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    onClick={handleTest}
                    disabled={testStatus === 'testing'}
                    className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold"
                >
                    {testStatus === 'testing' ? 'กำลังทดสอบ...' : 'เปิดเสียง / ทดสอบเสียง'}
                </button>
                <div className="flex items-center gap-2">
                    <span id="test-language-label" className="text-xs text-muted">ภาษาเสียงทดสอบ</span>
                    <div role="group" aria-labelledby="test-language-label" className="flex items-center bg-bg-soft/60 border border-line rounded-lg p-1">
                        {([['th', 'ไทย'], ['en', 'อังกฤษ']] as [AudioTestLanguage, string][]).map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setLanguage(value)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${language === value ? 'bg-line text-white' : 'text-muted hover:text-fg'}`}
                                aria-pressed={language === value}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            {testMessage[testStatus] && (
                <div className={`text-sm ${testStatus === 'failed' ? 'text-red-400' : testStatus === 'testing' ? 'text-sky-300' : 'text-green-400'}`}>
                    {testMessage[testStatus]}
                </div>
            )}
        </section>
    );
}
