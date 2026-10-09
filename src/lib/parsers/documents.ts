import type { NormalizedMessage } from '@/types';
import { generateId } from '@/lib/utils';
import { parseCsv, csvToObjects } from '@/lib/csv';

export function parseTextFile(text: string, filename: string = 'document.txt'): NormalizedMessage[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length > 1) {
    return paragraphs.map((para, i) => ({
      id: generateId(),
      originalText: para,
      sender: 'Document',
      timestamp: new Date(),
      sourceType: 'document',
      sourceFilename: filename,
      sourceIdentifier: `${filename}#p${i + 1}`,
      messageIndex: i + 1,
    }));
  }

  return [
    {
      id: generateId(),
      originalText: text.trim(),
      sender: 'Document',
      timestamp: new Date(),
      sourceType: 'document',
      sourceFilename: filename,
      sourceIdentifier: `${filename}#1`,
      messageIndex: 1,
    },
  ];
}

export function parseCsvFile(text: string, filename: string = 'document.csv'): NormalizedMessage[] {
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return parseTextFile(text, filename);
  }

  const objects = csvToObjects(rows);
  return objects.map((obj, i) => {
    const textContent = Object.entries(obj)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' | ');

    return {
      id: generateId(),
      originalText: textContent,
      sender: obj.sender || obj.from || obj.author || 'CSV Record',
      timestamp: obj.date || obj.timestamp ? new Date(obj.date || obj.timestamp) : new Date(),
      sourceType: 'document',
      sourceFilename: filename,
      sourceIdentifier: `${filename}#row${i + 2}`,
      messageIndex: i + 1,
    };
  });
}

export function parseJsonFile(text: string, filename: string = 'document.json'): NormalizedMessage[] {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.map((item, i) => ({
        id: generateId(),
        originalText: typeof item === 'string' ? item : JSON.stringify(item, null, 2),
        sender: item.sender || item.from || 'JSON Record',
        timestamp: item.timestamp || item.date ? new Date(item.timestamp || item.date) : new Date(),
        sourceType: 'document',
        sourceFilename: filename,
        sourceIdentifier: `${filename}#${i + 1}`,
        messageIndex: i + 1,
      }));
    }
  } catch {
    // Keep as plain text
  }

  return [
    {
      id: generateId(),
      originalText: text.trim(),
      sender: 'Document',
      timestamp: new Date(),
      sourceType: 'document',
      sourceFilename: filename,
      sourceIdentifier: `${filename}#1`,
      messageIndex: 1,
    },
  ];
}

export function parseEmlFile(text: string, filename: string = 'email.eml'): NormalizedMessage[] {
  const headersEnd = text.indexOf('\r\n\r\n') !== -1 ? text.indexOf('\r\n\r\n') : text.indexOf('\n\n');
  const headerText = headersEnd !== -1 ? text.substring(0, headersEnd) : text;
  const bodyText = headersEnd !== -1 ? text.substring(headersEnd).trim() : text;

  const headers: Record<string, string> = {};
  headerText.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (match) headers[match[1].toLowerCase()] = match[2];
  });

  return [
    {
      id: generateId(),
      originalText: bodyText,
      subject: headers['subject'],
      sender: headers['from'] || 'Unknown Sender',
      recipient: headers['to'],
      timestamp: headers['date'] ? new Date(headers['date']) : new Date(),
      sourceType: 'document',
      sourceFilename: filename,
      sourceIdentifier: `${filename}#1`,
      messageIndex: 1,
    },
  ];
}
