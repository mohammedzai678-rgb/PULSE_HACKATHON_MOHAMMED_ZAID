import type { NormalizedMessage } from '@/types';
import { generateId } from '@/lib/utils';
import { parseCsv, csvToObjects } from '@/lib/csv';
import { parseTimestampValue } from './timestamps';

export function parseSmsExport(
  text: string,
  filenameOrType: string = 'sms.txt',
  format?: 'csv' | 'json' | 'text'
): NormalizedMessage[] {
  const filename = filenameOrType.includes('/') ? 'sms-export.txt' : filenameOrType;
  let detectedFormat = format;

  if (!detectedFormat) {
    const lower = (filenameOrType + ' ' + text.slice(0, 200)).toLowerCase();
    if (lower.includes('json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
      detectedFormat = 'json';
    } else if (lower.includes('csv') || (text.includes(',') && text.split('\n')[0].includes(','))) {
      detectedFormat = 'csv';
    } else {
      detectedFormat = 'text';
    }
  }

  const messages: NormalizedMessage[] = [];

  if (detectedFormat === 'json') {
    try {
      const data = JSON.parse(text);
      const list = Array.isArray(data) ? data : data.sms || data.messages || [data];
      if (Array.isArray(list)) {
        list.forEach((item: any, i: number) => {
          const body = item.body || item.message || item.text || (typeof item === 'string' ? item : '');
          if (!body) return;
          const isOtp = isOtpMessage(body);
          const rawDate = item.date || item.timestamp || item.time;
          const parsed = parseTimestampValue(rawDate, 'dmy');

          messages.push({
            id: generateId(),
            originalText: body,
            sender: item.address || item.sender || item.from || (item.type === '2' ? 'Me' : 'Unknown Sender'),
            timestamp: parsed.date || new Date(),
            sourceType: 'sms',
            sourceFilename: filename,
            sourceIdentifier: `${filename}#${item.id || i + 1}`,
            messageIndex: i + 1,
            sensitive: isOtp ? 'otp' : undefined,
          });
        });
        return messages;
      }
    } catch {
      // Fallback to text
    }
  }

  if (detectedFormat === 'csv') {
    const rows = parseCsv(text);
    if (rows.length >= 2) {
      const objects = csvToObjects(rows);
      objects.forEach((obj, i) => {
        const body = obj.body || obj.message || obj.text || obj.content || Object.values(obj).join(' ');
        if (!body.trim()) return;
        const isOtp = isOtpMessage(body);
        const rawDate = obj.date || obj.timestamp || obj.time;
        const parsed = parseTimestampValue(rawDate, 'dmy');

        messages.push({
          id: generateId(),
          originalText: body,
          sender: obj.address || obj.sender || obj.from || obj.number || 'Unknown Sender',
          timestamp: parsed.date || new Date(),
          sourceType: 'sms',
          sourceFilename: filename,
          sourceIdentifier: `${filename}#row${i + 2}`,
          messageIndex: i + 1,
          sensitive: isOtp ? 'otp' : undefined,
        });
      });
      return messages;
    }
  }

  // Plain text fallback (one message per non-empty block)
  const blocks = text.split(/\r?\n\r?\n/).map((b) => b.trim()).filter(Boolean);
  const items = blocks.length > 0 ? blocks : [text.trim()];

  items.forEach((item, i) => {
    if (!item) return;
    const isOtp = isOtpMessage(item);
    messages.push({
      id: generateId(),
      originalText: item,
      sender: 'SMS',
      timestamp: new Date(),
      sourceType: 'sms',
      sourceFilename: filename,
      sourceIdentifier: `${filename}#${i + 1}`,
      messageIndex: i + 1,
      sensitive: isOtp ? 'otp' : undefined,
    });
  });

  return messages;
}

function isOtpMessage(content: string): boolean {
  return /verification code|otp|one time password|passcode/i.test(content) && /\b\d{4,8}\b/.test(content);
}
