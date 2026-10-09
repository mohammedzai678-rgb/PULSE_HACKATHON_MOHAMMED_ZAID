import type { ExtractedDateTime, DateKind } from '@/types';
import { generateId } from '@/lib/utils';
import { addDays, setHours, setMinutes } from 'date-fns';

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

const DAY_MAP: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

function determineDateKind(surroundingText: string): DateKind {
  const lower = surroundingText.toLowerCase();
  if (/(submit|submission|hand in|turn in|upload by|due by)/i.test(lower)) return 'submission';
  if (/(register|registration|enroll|portal closes|apply by)/i.test(lower)) return 'registration';
  if (/(deadline|last date|due date|cut-off|strictly before|last day)/i.test(lower)) return 'deadline';
  if (/(meeting|conference|call|session|zoom|teams|google meet|discussion)/i.test(lower)) return 'meeting';
  if (/(drive|exam|test|commencement|event|workshop|ceremony|holiday)/i.test(lower)) return 'event';
  if (/(remind|reminder)/i.test(lower)) return 'reminder';
  if (/(published|circular dated|dated)/i.test(lower)) return 'publication';
  return 'unknown';
}

function extractTimeFromText(text: string): { timeStr?: string; hours?: number; minutes?: number } {
  const timeRegex = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;
  const match = timeRegex.exec(text);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    const isPm = match[3].toLowerCase() === 'pm';
    if (isPm && hours < 12) hours += 12;
    if (!isPm && hours === 12) hours = 0;
    const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    return { timeStr, hours, minutes };
  }
  const time24Regex = /\b([01]?\d|2[0-3]):([0-5]\d)\b/;
  const match24 = time24Regex.exec(text);
  if (match24) {
    return {
      timeStr: `${String(match24[1]).padStart(2, '0')}:${match24[2]}`,
      hours: parseInt(match24[1], 10),
      minutes: parseInt(match24[2], 10),
    };
  }
  return {};
}

export function extractDates(text: string, messageTimestamp?: Date, messageId: string = ''): ExtractedDateTime[] {
  const dates: ExtractedDateTime[] = [];
  const baseDate = messageTimestamp || new Date();
  const currentYear = baseDate.getFullYear();
  const seenPhrases = new Set<string>();

  const addExtracted = (
    phrase: string,
    extractedDate: Date | undefined,
    basis: 'explicit' | 'inferred' | 'ambiguous',
    needsConfirmation: boolean,
    surroundingContext: string,
    timeStr?: string
  ) => {
    if (seenPhrases.has(phrase.toLowerCase())) return;
    seenPhrases.add(phrase.toLowerCase());

    const kind = determineDateKind(surroundingContext);
    const isDeadline = kind === 'deadline' || kind === 'submission' || kind === 'registration' ||
      /(due|by|before|deadline|last date)/i.test(surroundingContext);

    dates.push({
      id: generateId(),
      originalPhrase: phrase,
      kind,
      date: extractedDate,
      time: timeStr,
      basis,
      needsConfirmation,
      sourceMessageId: messageId,
      // Backward compatibility property for existing views
      ...(isDeadline ? { isDeadline: true } : {}),
    } as ExtractedDateTime & { isDeadline?: boolean });
  };

  // 1. Month Name Patterns (e.g., "October 12, 2026", "12th Oct 2026", "October 15")
  const monthNameRegex = /\b(?:(\d{1,2})(?:st|nd|rd|th)?\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(\d{1,2})(?:st|nd|rd|th)?)?(?:,?\s+(\d{4}))?\b/gi;
  let match: RegExpExecArray | null;

  while ((match = monthNameRegex.exec(text)) !== null) {
    const rawPhrase = match[0];
    const monthKey = match[2].toLowerCase();
    const month = MONTH_MAP[monthKey];
    const day = parseInt(match[1] || match[3] || '1', 10);
    const year = match[4] ? parseInt(match[4], 10) : currentYear;

    if (month !== undefined && day >= 1 && day <= 31) {
      let d = new Date(year, month, day);
      // Context snippet around match
      const start = Math.max(0, match.index - 30);
      const end = Math.min(text.length, match.index + rawPhrase.length + 30);
      const context = text.slice(start, end);
      const timeInfo = extractTimeFromText(context);

      if (timeInfo.hours !== undefined && timeInfo.minutes !== undefined) {
        d = setHours(setMinutes(d, timeInfo.minutes), timeInfo.hours);
      }

      addExtracted(
        rawPhrase,
        d,
        match[4] ? 'explicit' : 'inferred',
        !match[4],
        context,
        timeInfo.timeStr
      );
    }
  }

  // 2. ISO Dates (YYYY-MM-DD)
  const isoRegex = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  while ((match = isoRegex.exec(text)) !== null) {
    const rawPhrase = match[0];
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);

    const start = Math.max(0, match.index - 30);
    const end = Math.min(text.length, match.index + rawPhrase.length + 30);
    const context = text.slice(start, end);
    const timeInfo = extractTimeFromText(context);

    let d = new Date(year, month, day);
    if (timeInfo.hours !== undefined && timeInfo.minutes !== undefined) {
      d = setHours(setMinutes(d, timeInfo.minutes), timeInfo.hours);
    }

    addExtracted(rawPhrase, d, 'explicit', false, context, timeInfo.timeStr);
  }

  // 3. Numeric Dates (DD/MM/YYYY or DD-MM-YYYY)
  const slashRegex = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g;
  while ((match = slashRegex.exec(text)) !== null) {
    const rawPhrase = match[0];
    let day = parseInt(match[1], 10);
    let month = parseInt(match[2], 10) - 1;
    let year = parseInt(match[3], 10);
    if (year < 100) year += 2000;

    // Detect if mm/dd or dd/mm
    let basis: 'explicit' | 'inferred' | 'ambiguous' = 'explicit';
    if (day > 12 && month <= 11) {
      // Definite DD/MM
    } else if (month > 11 && day <= 12) {
      // Swapped MM/DD
      const temp = day;
      day = month + 1;
      month = temp - 1;
    } else {
      basis = 'ambiguous';
    }

    const start = Math.max(0, match.index - 30);
    const end = Math.min(text.length, match.index + rawPhrase.length + 30);
    const context = text.slice(start, end);
    const timeInfo = extractTimeFromText(context);

    let d = new Date(year, month, day);
    if (timeInfo.hours !== undefined && timeInfo.minutes !== undefined) {
      d = setHours(setMinutes(d, timeInfo.minutes), timeInfo.hours);
    }

    addExtracted(rawPhrase, d, basis, basis === 'ambiguous', context, timeInfo.timeStr);
  }

  // 4. Relative Day Words ("today", "tomorrow", "day after tomorrow", "yesterday")
  const relRegex = /\b(day after tomorrow|tomorrow|today|yesterday)\b/gi;
  while ((match = relRegex.exec(text)) !== null) {
    const rawPhrase = match[0];
    const lower = rawPhrase.toLowerCase();
    let offset = 0;
    if (lower === 'tomorrow') offset = 1;
    else if (lower === 'day after tomorrow') offset = 2;
    else if (lower === 'yesterday') offset = -1;

    const start = Math.max(0, match.index - 30);
    const end = Math.min(text.length, match.index + rawPhrase.length + 30);
    const context = text.slice(start, end);
    const timeInfo = extractTimeFromText(context);

    let d = addDays(baseDate, offset);
    if (timeInfo.hours !== undefined && timeInfo.minutes !== undefined) {
      d = setHours(setMinutes(d, timeInfo.minutes), timeInfo.hours);
    }

    addExtracted(rawPhrase, d, 'inferred', !messageTimestamp, context, timeInfo.timeStr);
  }

  // 5. Weekdays (e.g. "this Friday", "next Monday")
  const weekdayRegex = /\b(this|next|coming)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi;
  while ((match = weekdayRegex.exec(text)) !== null) {
    const rawPhrase = match[0];
    const dayName = match[2].toLowerCase();
    const targetDay = DAY_MAP[dayName];
    if (targetDay !== undefined) {
      const currentDay = baseDate.getDay();
      let diff = targetDay - currentDay;
      if (diff <= 0) diff += 7;
      if (match[1]?.toLowerCase() === 'next') diff += 7;

      const start = Math.max(0, match.index - 30);
      const end = Math.min(text.length, match.index + rawPhrase.length + 30);
      const context = text.slice(start, end);
      const timeInfo = extractTimeFromText(context);

      let d = addDays(baseDate, diff);
      if (timeInfo.hours !== undefined && timeInfo.minutes !== undefined) {
        d = setHours(setMinutes(d, timeInfo.minutes), timeInfo.hours);
      }

      addExtracted(rawPhrase, d, 'inferred', true, context, timeInfo.timeStr);
    }
  }

  return dates;
}
