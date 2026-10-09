/** Shared timestamp helpers for tabular / JSON sources (SMS, CSV, generic JSON). */

export type DateOrder = 'dmy' | 'mdy';

const NUMERIC_DATE = /(\d{1,4})[\/.\-](\d{1,2})[\/.\-](\d{1,4})/;

/** Returns the order only if the data proves it (a component > 12), otherwise undefined. */
export function detectNumericOrder(values: string[]): DateOrder | undefined {
  let dmy = false;
  let mdy = false;
  for (const v of values) {
    const m = NUMERIC_DATE.exec(v);
    if (!m || m[1].length === 4) continue;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a > 12 && a <= 31) dmy = true;
    if (b > 12 && b <= 31) mdy = true;
  }
  if (dmy && !mdy) return 'dmy';
  if (mdy && !dmy) return 'mdy';
  return undefined;
}

export interface ParsedTimestamp {
  date?: Date;
  /** true when a day/month order had to be guessed */
  assumed?: boolean;
}

export function parseTimestampValue(raw: string | number | undefined | null, order: DateOrder | undefined): ParsedTimestamp {
  if (raw === undefined || raw === null) return {};
  const v = String(raw).trim();
  if (!v) return {};
  if (/^\d{13}$/.test(v)) return { date: new Date(Number(v)) };
  if (/^\d{10}$/.test(v)) return { date: new Date(Number(v) * 1000) };
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
    const d = new Date(v.replace(' ', 'T'));
    if (!isNaN(d.getTime())) return { date: d };
  }
  const m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4}),?\s*(?:(\d{1,2})[:.](\d{2})(?::(\d{2}))?\s*([ap]\.?m\.?)?)?/i.exec(v);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const yRaw = Number(m[3]);
    const y = yRaw < 100 ? 2000 + yRaw : yRaw;
    let use = order;
    let assumed = false;
    if (!use) {
      if (a > 12) use = 'dmy';
      else if (b > 12) use = 'mdy';
      else {
        use = 'dmy';
        assumed = true;
      }
    }
    const day = use === 'dmy' ? a : b;
    const month = use === 'dmy' ? b : a;
    let hour = m[4] ? Number(m[4]) : 0;
    if (m[7]) {
      hour = hour % 12;
      if (m[7].toLowerCase().startsWith('p')) hour += 12;
    }
    const d = new Date(y, month - 1, day, hour, m[5] ? Number(m[5]) : 0, m[6] ? Number(m[6]) : 0);
    if (d.getMonth() === month - 1 && d.getDate() === day) return { date: d, assumed };
    return {};
  }
  const fallback = new Date(v);
  return isNaN(fallback.getTime()) ? {} : { date: fallback };
}
