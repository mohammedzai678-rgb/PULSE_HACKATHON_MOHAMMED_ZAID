import { describe, it, expect } from 'vitest';
import { extractEntities } from './entity-extractor';

describe('Named Entity Extractor (NER Intelligence)', () => {
  it('extracts emails and URLs', () => {
    const text = 'Submit resumes to careers@company.org or upload at https://portal.careers.com/apply';
    const entities = extractEntities(text);

    const email = entities.find((e) => e.type === 'email');
    expect(email?.value).toBe('careers@company.org');

    const url = entities.find((e) => e.type === 'url');
    expect(url?.value).toBe('https://portal.careers.com/apply');
  });

  it('extracts currency amounts in various notations', () => {
    const text = 'Late fee penalty of ₹500 or $50 will be charged on overdue amount of Rs. 2,500';
    const entities = extractEntities(text);

    const amounts = entities.filter((e) => e.type === 'amount');
    expect(amounts.length).toBeGreaterThanOrEqual(2);
  });

  it('extracts campus locations and room numbers', () => {
    const text = 'Meeting in Room 204 next to Lab 2 and the Auditorium';
    const entities = extractEntities(text);

    const locations = entities.filter((e) => e.type === 'location');
    expect(locations.some((l) => l.value.includes('Room 204'))).toBe(true);
    expect(locations.some((l) => l.value.includes('Lab 2'))).toBe(true);
    expect(locations.some((l) => l.value.includes('Auditorium'))).toBe(true);
  });

  it('extracts @mentions', () => {
    const text = 'Heads up @mohammed and @admin please approve the draft';
    const entities = extractEntities(text);

    const mentions = entities.filter((e) => e.type === 'mention');
    expect(mentions.some((m) => m.value.includes('mohammed'))).toBe(true);
    expect(mentions.some((m) => m.value.includes('admin'))).toBe(true);
  });

  it('extracts contact phone numbers', () => {
    const text = 'For emergencies call 9876543210 or +1 800-555-0199';
    const entities = extractEntities(text);

    const phones = entities.filter((e) => e.type === 'phone');
    expect(phones.length).toBeGreaterThan(0);
  });
});
