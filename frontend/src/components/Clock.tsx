interface ClockProps {
    serverTime: Date;
    offset: number;
    synced: boolean;
    error: string | null;
}

export function Clock({ serverTime, offset, synced, error }: ClockProps) {
    const h = serverTime.getHours().toString().padStart(2, '0');
    const m = serverTime.getMinutes().toString().padStart(2, '0');
    const s = serverTime.getSeconds().toString().padStart(2, '0');

    const offsetMinutes = Math.abs(Math.round(offset / 1000 / 60));

    let statusText: string;
    let statusColor: string;

    if (error) {
        statusText = 'ซิงก์เวลาไม่สำเร็จ ใช้เวลาของเครื่องนี้แทน';
        statusColor = 'text-amber-400';
    } else if (!synced) {
        statusText = 'กำลังซิงก์เวลากับเซิร์ฟเวอร์...';
        statusColor = 'text-yellow-400';
    } else if (offsetMinutes > 0) {
        statusText = `ซิงก์แล้ว (นาฬิกาเครื่องนี้คลาดเคลื่อน ${offsetMinutes} นาที ระบบชดเชยให้แล้ว)`;
        statusColor = 'text-green-400';
    } else {
        statusText = 'ซิงก์เวลากับเซิร์ฟเวอร์แล้ว';
        statusColor = 'text-green-400';
    }

    return (
        <div className="text-center mb-8">
            <div className="text-sm text-muted tracking-widest mb-2 font-semibold">เวลาปัจจุบัน</div>
            <div className="text-5xl md:text-7xl font-black tabular-nums tracking-tight text-white drop-shadow-[0_0_15px_rgba(20,74,224,0.5)]">
                {h} <span className="animate-pulse text-primary">:</span> {m} <span className="animate-pulse text-primary">:</span> {s}
            </div>
            <div className={`mt-2 text-sm font-medium ${statusColor}`}>
                {statusText}
            </div>
        </div>
    );
}
