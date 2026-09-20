import { useState } from 'react';
import { useAlarms } from '../hooks/useAlarms';
import { useChannel } from '../context/ChannelContext';
import type { AudioTestLanguage } from '../services/audioTest';

type TestStatus = 'idle' | 'testing' | 'success' | 'fallback' | 'failed';

export function ReadinessCard({ clockReady }: { clockReady: boolean }) {
    const { isAudioEnabled, testAudio } = useAlarms();
    const { leaseConfirmed } = useChannel();
    const [language, setLanguage] = useState<AudioTestLanguage>('th');
    const [testStatus, setTestStatus] = useState<TestStatus>('idle');

    const missing: string[] = [];
    if (!leaseConfirmed) missing.push('กำลังยืนยันสิทธิ์ช่อง');
    if (!clockReady) missing.push('นาฬิกายังไม่ซิงก์กับเซิร์ฟเวอร์');
    if (!isAudioEnabled) missing.push('ยังไม่ได้เปิดเสียงของเบราว์เซอร์');
    const ready = missing.length === 0;

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
        <section aria-label="สถานะความพร้อม" className="space-y-2">
            <div
                className={`rounded-xl border px-4 py-3 ${ready
                    ? 'border-green-500/40 bg-green-500/10 text-green-300'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-300'}`}
            >
                <div className="flex items-center justify-between gap-3">
                    <div role="status" className="min-w-0">
                        <div className="font-bold">
                            {ready ? '✓ พร้อมเล่นเสียงตามเวลา' : '⚠ ยังไม่พร้อมเล่นเสียง'}
                        </div>
                        {!ready && <div className="text-sm mt-0.5">{missing.join(' · ')}</div>}
                    </div>
                    <button
                        type="button"
                        onClick={handleTest}
                        disabled={testStatus === 'testing'}
                        className="shrink-0 px-3 py-1.5 rounded-lg border border-line bg-white/10 hover:bg-white/20 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-white/60"
                    >
                        {testStatus === 'testing' ? 'กำลังทดสอบ...' : isAudioEnabled ? 'ทดสอบเสียง' : 'เปิดเสียง (ทดสอบ)'}
                    </button>
                </div>
                {!isAudioEnabled && (
                    <div className="text-xs mt-2 text-amber-200">
                        หรือกด &quot;เพิ่มรายการประกาศ&quot; ระบบจะเปิดเสียงให้อัตโนมัติ
                    </div>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <span id="test-language-label" className="text-xs text-muted">ภาษาเสียงทดสอบ</span>
                <div role="group" aria-labelledby="test-language-label" className="flex items-center bg-bg-soft/60 border border-line rounded-lg p-0.5">
                    {([['th', 'ไทย'], ['en', 'อังกฤษ']] as [AudioTestLanguage, string][]).map(([value, label]) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setLanguage(value)}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${language === value ? 'bg-line text-white' : 'text-muted hover:text-fg'}`}
                            aria-pressed={language === value}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                {testMessage[testStatus] && (
                    <span className={`text-sm ${testStatus === 'failed' ? 'text-red-400' : testStatus === 'testing' ? 'text-sky-300' : 'text-green-400'}`}>
                        {testMessage[testStatus]}
                    </span>
                )}
            </div>
        </section>
    );
}
