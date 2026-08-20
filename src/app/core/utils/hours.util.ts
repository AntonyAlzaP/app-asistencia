import { AttendanceRecord, DailyHours } from '../models/attendance-record.model';

/** Returns the ISO (YYYY-MM-DD) local date for a timestamp. */
export function toLocalDateKey(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Monday-based start/end (inclusive) of the week containing `date`. */
export function getWeekRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  const dayOfWeek = (start.getDay() + 6) % 7; // 0 = Monday
  start.setDate(start.getDate() - dayOfWeek);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Pairs chronological in/out records per calendar day and sums worked hours.
 * A trailing unmatched "in" on the current day counts as an open session,
 * with elapsed time computed up to `now`.
 */
export function computeDailyHours(records: AttendanceRecord[], now: Date = new Date()): DailyHours[] {
  const sorted = [...records].sort((a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime());
  const byDate = new Map<string, AttendanceRecord[]>();

  for (const record of sorted) {
    const key = toLocalDateKey(record.takenAt);
    if (!byDate.has(key)) {
      byDate.set(key, []);
    }
    byDate.get(key)!.push(record);
  }

  const todayKey = toLocalDateKey(now.toISOString());
  const results: DailyHours[] = [];

  for (const [date, dayRecords] of byDate.entries()) {
    let millis = 0;
    let openSession = false;
    let pendingIn: AttendanceRecord | null = null;

    for (const record of dayRecords) {
      if (record.type === 'in') {
        pendingIn = record;
      } else if (record.type === 'out' && pendingIn) {
        millis += new Date(record.takenAt).getTime() - new Date(pendingIn.takenAt).getTime();
        pendingIn = null;
      }
    }

    if (pendingIn && date === todayKey) {
      millis += now.getTime() - new Date(pendingIn.takenAt).getTime();
      openSession = true;
    }

    results.push({ date, hours: millis / 3_600_000, isOpenSession: openSession });
  }

  return results.sort((a, b) => a.date.localeCompare(b.date));
}

export function sumHours(daily: DailyHours[]): number {
  return daily.reduce((acc, d) => acc + d.hours, 0);
}

export function formatHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

export function formatElapsed(msElapsed: number): string {
  const totalSeconds = Math.max(0, Math.floor(msElapsed / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => n.toString().padStart(2, '0')).join(':');
}
