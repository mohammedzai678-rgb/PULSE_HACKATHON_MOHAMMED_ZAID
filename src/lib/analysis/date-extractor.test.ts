import { describe, it, expect } from 'vitest';
import { extractDates } from './date-extractor';

describe('Date & Time Extractor (Temporal Intelligence)', () => {
  it('extracts ISO dates (YYYY-MM-DD)', () => {
    const dates = extractDates('The final examination is scheduled on 2026-11-20 at 10:00 AM');
    expect(dates.length).toBeGreaterThan(0);
    const date = dates[0];
    expect(date.basis).toBe('explicit');
    expect(date.date?.getFullYear()).toBe(2026);
    expect(date.date?.getMonth()).toBe(10); // November is 10 (0-indexed)
    expect(date.date?.getDate()).toBe(20);
    expect(date.time).toBe('10:00');
  });

  it('extracts relative day expressions (tomorrow, day after tomorrow)', () => {
    const baseDate = new Date(2026, 9, 9); // Oct 9, 2026
    const dates = extractDates('Please submit the project report tomorrow by 5pm', baseDate);
    expect(dates.length).toBeGreaterThan(0);
    const tomorrow = dates[0];
    expect(tomorrow.basis).toBe('inferred');
    expect(tomorrow.kind).toBe('submission');
    expect(tomorrow.date?.getDate()).toBe(10);
  });

  it('classifies deadlines and cut-offs accurately', () => {
    const dates = extractDates('Last date to pay tuition fees is October 15, 2026 before 11:59 PM');
    expect(dates.length).toBeGreaterThan(0);
    const deadline = dates[0];
    expect(deadline.kind).toBe('deadline');
    expect(deadline.date?.getMonth()).toBe(9); // October
    expect(deadline.date?.getDate()).toBe(15);
  });

  it('handles 24-hour military time formats', () => {
    const dates = extractDates('Campus gate closes on 2026-10-12 at 22:30 hrs');
    expect(dates.length).toBeGreaterThan(0);
    expect(dates[0].time).toBe('22:30');
  });
});
