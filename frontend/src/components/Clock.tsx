import { useTimeSync } from '../hooks/useTimeSync';

export function Clock() {
    const { serverTime, offset, isSyncing, error } = useTimeSync();

    const h = serverTime.getHours().toString().padStart(2, '0');
    const m = serverTime.getMinutes().toString().padStart(2, '0');
    const s = serverTime.getSeconds().toString().padStart(2, '0');

    // Determine status message and color
    const offsetMinutes = Math.abs(Math.round(offset / 1000 / 60));
    const offsetSign = offset > 0 ? '+' : '-';

    let statusText = '';
    let statusColor = '';

    if (error) {
        statusText = 'Sync failed, using local time';
        statusColor = 'text-red-400';
    } else if (isSyncing && offset === 0) {
        statusText = 'Syncing with Thailand time...';
        statusColor = 'text-yellow-400';
    } else if (offsetMinutes > 0) {
        statusText = `Using local time | Offset: ${offsetSign}${offsetMinutes}m`;
        statusColor = 'text-amber-400';
    } else {
        statusText = 'Synced with Thailand time ✓';
        statusColor = 'text-green-400';
    }

    return (
        <div className="text-center mb-8">
            <div className="text-sm text-muted uppercase tracking-widest mb-2 font-semibold">Current Time</div>
            <div className="text-5xl md:text-7xl font-black tabular-nums tracking-tight text-white drop-shadow-[0_0_15px_rgba(20,74,224,0.5)]">
                {h} <span className="animate-pulse text-primary">:</span> {m} <span className="animate-pulse text-primary">:</span> {s}
            </div>
            <div className={`mt-2 text-sm font-medium ${statusColor}`}>
                {statusText}
            </div>
        </div>
    );
}
