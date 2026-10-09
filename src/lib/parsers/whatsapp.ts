import type { NormalizedMessage } from '@/types';
import { generateId } from '@/lib/utils';

export interface WhatsAppParseOptions {
  /** Force date order. 'auto' detects it from the file (default). */
  dateOrder?: 'auto' | 'dmy' | 'mdy';
}

// date, time. Groups: 1 a, 2 b, 3 c, 4 hour, 5 minute, 6 second, 7 am/pm
const DT = '(\\d{1,4})[\\/.\\-](\\d{1,2})[\\/.\\-](\\d{1,4}),?\\s+(\\d{1,2})[:.](\\d{2})(?::(\\d{2}))?\\s*([ap]\\.?\\s?m\\.?)?';
const BRACKET = new RegExp(`^\\[${DT}\\]\\s*(.*)$`, 'i');
const DASH = new RegExp(`^${DT}\\s*[-–—]\\s*(.*)$`, 'i');

const SYSTEM_PATTERNS = [
  /end-to-end encrypted/i,
  /\b(created (this )?group|created the group)\b/i,
  /\b(added|removed|left|joined|was added|were added)\b.*$/i,
  /changed (the )?(group |this group'?s? )?(subject|name|icon|description|settings|their phone number)/i,
  /security code changed/i,
  /you('| a)re now an admin|is now an admin/i,
  /messages (to this group )?are now secured/i,
  /\bdisappearing messages\b/i,
  /missed (voice|video) call/i,
];

const MEDIA_RE =
  /^(<media omitted>|<attached:\s*(.+?)>|(.+?\.(?:jpg|jpeg|png|webp|gif|mp4|mov|opus|ogg|m4a|mp3|pdf|docx?|xlsx?|pptx?|vcf|zip))\s*\(file attached\)|(image|video|audio|sticker|document|gif|contact card) omitted)$/i;
const DELETED_RE = /^(🚫\s*)?(this message was deleted|you deleted this message)\.?$/i;
const EDITED_RE = /\s*(<this message was edited>|\(edited\))\s*$/i;

interface RawHeader {
  a: number;
  b: number;
  c: number;
  hh: number;
  mm: number;
  ss: number;
  ampm?: string;
  rest: string;
}

function matchHeader(line: string): RawHeader | null {
  const m = BRACKET.exec(line) ?? DASH.exec(line);
  if (!m) return null;
  return {
    a: Number(m[1]),
    b: Number(m[2]),
    c: Number(m[3]),
    hh: Number(m[4]),
    mm: Number(m[5]),
    ss: m[6] ? Number(m[6]) : 0,
    ampm: m[7]?.toLowerCase().replace(/[.\s]/g, ''),
    rest: m[8] ?? '',
  };
}

function rawDigits(line: string): { aLen: number } {
  const m = /^\[?(\d+)/.exec(line);
  return { aLen: m ? m[1].length : 0 };
}

function buildDate(h: RawHeader, aLen: number, order: 'dmy' | 'mdy'): Date | undefined {
  let y: number, mo: number, d: number;
  if (aLen === 4) {
    y = h.a;
    mo = h.b;
    d = h.c;
  } else {
    y = h.c < 100 ? 2000 + h.c : h.c;
    if (order === 'dmy') {
      d = h.a;
      mo = h.b;
    } else {
      mo = h.a;
      d = h.b;
    }
  }
  let hour = h.hh;
  if (h.ampm) {
    hour = hour % 12;
    if (h.ampm.startsWith('p')) hour += 12;
  }
  const date = new Date(y, mo - 1, d, hour, h.mm, h.ss);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d || hour > 23) return undefined;
  return date;
}

export function conversationNameFromFilename(filename: string): string {
  const m = /whatsapp chat with (.+?)(?:\.txt)?$/i.exec(filename.replace(/\.[a-z0-9]+$/i, (x) => x));
  return m ? m[1].trim() : filename.replace(/\.[a-z0-9]+$/i, '');
}

export function parseWhatsAppChat(text: string, filename: string = 'WhatsApp Chat.txt', options: WhatsAppParseOptions = {}): NormalizedMessage[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.replace(/[\u200e\u200f\u202a-\u202e]/g, '').replace(/[\u202f\u00a0]/g, ' '));

  // Pass 1: detect numeric date order
  let dmyEvidence = false;
  let mdyEvidence = false;
  for (const line of lines) {
    const h = matchHeader(line);
    if (!h) continue;
    if (rawDigits(line).aLen === 4) continue;
    if (h.a > 12 && h.a <= 31) dmyEvidence = true;
    if (h.b > 12 && h.b <= 31) mdyEvidence = true;
  }
  let order: 'dmy' | 'mdy';
  let assumed = false;
  if (options.dateOrder && options.dateOrder !== 'auto') order = options.dateOrder;
  else if (dmyEvidence && !mdyEvidence) order = 'dmy';
  else if (mdyEvidence && !dmyEvidence) order = 'mdy';
  else {
    order = 'dmy';
    assumed = true; // truly ambiguous: day-first assumed and flagged
  }
  const dateOrderHint: 'dmy' | 'mdy' | 'unknown' = assumed ? 'unknown' : order;

  const conversationName = conversationNameFromFilename(filename);
  const messages: NormalizedMessage[] = [];
  let current: { h: RawHeader; aLen: number; body: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const { h, aLen, body } = current;
    const index = messages.length + 1;
    const ts = buildDate(h, aLen, order);
    const full = body.join('\n').trim();

    // Separate "Sender: text" from system messages
    const isSystemShape = SYSTEM_PATTERNS.some((p) => p.test(full)) && !/^[^:]{1,60}:\s/.test(full);
    const sm = /^([^:]{1,80}?):\s([\s\S]*)$/.exec(full);
    let sender = '';
    let content = full;
    let isSystemMessage = false;
    if (!sm || isSystemShape) {
      isSystemMessage = true;
    } else {
      sender = sm[1].replace(/^~\s*/, '').trim();
      content = sm[2].trim();
    }

    let isEdited = false;
    if (EDITED_RE.test(content)) {
      isEdited = true;
      content = content.replace(EDITED_RE, '').trim();
    }
    const mediaMatch = MEDIA_RE.exec(content);
    const isMedia = !!mediaMatch;
    const attachmentName = mediaMatch?.[2] ?? mediaMatch?.[3];
    const isDeleted = DELETED_RE.test(content);

    messages.push({
      id: generateId(),
      sourceType: 'whatsapp',
      sourceFilename: filename,
      sourceIdentifier: `${filename}#${index}`,
      sender,
      originalText: content,
      timestamp: ts,
      timestampAssumed: assumed && !!ts && h.a <= 12 && h.b <= 12 ? true : undefined,
      messageIndex: index,
      conversationName,
      isSystemMessage: isSystemMessage || undefined,
      isMedia: isMedia || undefined,
      isDeleted: isDeleted || undefined,
      isEdited: isEdited || undefined,
      attachments: attachmentName ? [attachmentName] : undefined,
      dateOrder: dateOrderHint,
    });
    current = null;
  };

  for (const line of lines) {
    const h = matchHeader(line);
    if (h) {
      flush();
      current = { h, aLen: rawDigits(line).aLen, body: [h.rest] };
    } else if (current) {
      current.body.push(line);
    }
  }
  flush();
  return messages;
}
