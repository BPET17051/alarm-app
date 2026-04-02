export interface NormalizedTime {
    h: number;
    m: number;
    s: number;
}

export function normalizeTime(h: number, m: number, s: number): NormalizedTime {
    const totalSeconds = (((h * 3600) + (m * 60) + s) % 86400 + 86400) % 86400;

    return {
        h: Math.floor(totalSeconds / 3600),
        m: Math.floor((totalSeconds % 3600) / 60),
        s: totalSeconds % 60
    };
}
