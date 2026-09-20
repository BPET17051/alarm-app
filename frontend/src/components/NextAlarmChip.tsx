import { useAlarms } from '../hooks/useAlarms';
import { formatAudioName } from '../utils/audio';

function formatCountdown(totalSeconds: number) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `อีก ${hours} ชั่วโมง ${minutes} นาที`;
    if (minutes > 0) return `อีก ${minutes} นาที ${seconds} วินาที`;
    return `อีก ${seconds} วินาที`;
}

const pad = (n: number) => n.toString().padStart(2, '0');

// Counts only pending items still to come today; a failed load must never read as "nothing scheduled".
export function NextAlarmChip({ serverTime }: { serverTime: Date }) {
    const { items, playedIds, alarmsStatus } = useAlarms();

    if (alarmsStatus === 'ready' && items.length === 0) return null;

    const nowSeconds = serverTime.getHours() * 3600 + serverTime.getMinutes() * 60 + serverTime.getSeconds();
    const next = items
        .filter((item) => item.notify_status === 'PENDING' && !playedIds.has(item.id))
        .map((item) => ({ item, at: item.h * 3600 + item.m * 60 + (item.s || 0) }))
        .filter(({ at }) => at > nowSeconds)
        .sort((a, b) => a.at - b.at)[0];

    let line: string;
    let tone = 'text-fg';
    if (alarmsStatus === 'error') {
        line = 'โหลดตารางประกาศไม่สำเร็จ';
        tone = 'text-danger';
    } else if (alarmsStatus === 'loading') {
        line = 'กำลังโหลดตารางประกาศ...';
        tone = 'text-muted';
    } else if (next) {
        line = `${pad(next.item.h)}:${pad(next.item.m)}:${pad(next.item.s || 0)} · ${formatCountdown(next.at - nowSeconds)} · ${formatAudioName(next.item.audioDisplayName)}`;
    } else {
        line = 'ไม่มีรายการที่รอเล่นในวันนี้';
        tone = 'text-muted';
    }

    return (
        <div className="rounded-xl border border-line bg-bg-soft/40 px-3 py-2 text-sm max-w-full">
            <span className="text-muted">รายการถัดไป </span>
            <span className={`font-semibold tabular-nums ${tone}`}>{line}</span>
        </div>
    );
}
