import { useState, useEffect } from 'react';

export function Clock() {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const h = time.getHours().toString().padStart(2, '0');
    const m = time.getMinutes().toString().padStart(2, '0');

    return (
        <div className="text-center mb-8">
            <div className="text-sm text-muted uppercase tracking-widest mb-2 font-semibold">Current Time</div>
            <div className="text-5xl md:text-7xl font-black tabular-nums tracking-tight text-white drop-shadow-[0_0_15px_rgba(20,74,224,0.5)]">
                {h} <span className="animate-pulse text-primary">:</span> {m} <span className="animate-pulse text-primary">:</span> {time.getSeconds().toString().padStart(2, '0')}
            </div>
            <div className="text-muted mt-2 text-sm">Synced with system</div>
        </div >
    );
}
