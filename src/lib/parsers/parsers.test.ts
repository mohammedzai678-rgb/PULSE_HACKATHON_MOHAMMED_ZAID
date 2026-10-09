import { describe, it, expect } from 'vitest';
import { parseWhatsAppChat } from './whatsapp';
import { parseSmsExport } from './sms';
import { parseEmlFile } from './documents';
import { parseFile } from './index';

describe('ETL Ingestion & Parser Layer', () => {
  it('parses standard WhatsApp export format', () => {
    const rawChat = `12/10/26, 14:30 - John Doe: Hey team, please review the final draft by tomorrow.\n12/10/26, 14:32 - Alice: Agreed, I will check it.`;
    const messages = parseWhatsAppChat(rawChat, 'chat.txt');

    expect(messages.length).toBe(2);
    expect(messages[0].sender).toBe('John Doe');
    expect(messages[0].originalText).toContain('review the final draft');
    expect(messages[1].sender).toBe('Alice');
  });

  it('parses SMS export format with sender numbers', () => {
    const rawSms = `From: +18005550199\nDate: 2026-10-10 09:00:00\nYour appointment is scheduled for tomorrow.`;
    const messages = parseSmsExport(rawSms, 'sms.txt');

    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].originalText).toContain('appointment is scheduled');
  });

  it('extracts headers and content from .eml email raw text', () => {
    const rawEml = `From: Dean Office <dean@university.edu>\nTo: student@university.edu\nSubject: Mandatory Hall Ticket Notice\nDate: 10 Oct 2026 10:00:00\n\nAll students must collect hall tickets before exams.`;
    const messages = parseEmlFile(rawEml, 'notice.eml');

    expect(messages.length).toBe(1);
    expect(messages[0].sender).toContain('dean@university.edu');
    expect(messages[0].subject).toBe('Mandatory Hall Ticket Notice');
    expect(messages[0].originalText).toContain('hall tickets before exams');
  });

  it('explicitly rejects JSON files with descriptive error', async () => {
    const jsonFile = new File(['{"test": true}'], 'data.json', { type: 'application/json' });
    await expect(parseFile(jsonFile, 'other')).rejects.toThrow('JSON files are not supported');
  });
});
