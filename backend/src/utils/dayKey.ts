const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function getCurrentDayKey(date: Date = new Date()): string {
  const bangkokNow = new Date(date.getTime() + BANGKOK_OFFSET_MS);
  return bangkokNow.toISOString().slice(0, 10);
}

export function getCurrentBangkokDayBounds(date: Date = new Date()) {
  const bangkokNow = new Date(date.getTime() + BANGKOK_OFFSET_MS);
  const startOfBangkokDay = new Date(Date.UTC(
    bangkokNow.getUTCFullYear(),
    bangkokNow.getUTCMonth(),
    bangkokNow.getUTCDate(),
    0,
    0,
    0,
    0
  ));

  return {
    startIso: new Date(startOfBangkokDay.getTime() - BANGKOK_OFFSET_MS).toISOString(),
    endIso: new Date(startOfBangkokDay.getTime() - BANGKOK_OFFSET_MS + DAY_MS).toISOString()
  };
}
