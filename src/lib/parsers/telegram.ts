import type { NormalizedMessage } from '@/types';
import { generateId } from '@/lib/utils';
import { htmlToText } from '@/lib/sanitize';

export const TELEGRAM_EXPORT_HELP =
  'In Telegram Desktop open the chat → ⋮ menu → "Export chat history", choose Format: "Machine-readable JSON" (recommended) or HTML, then upload result.json (or messages.html).';

interface TgEntity {
  type?: string;
  text?: string;
}
interface TgMessage {
  id?: number;
  type?: string;
  date?: string;
  date_unixtime?: string;
  from?: string;
  from_id?: string;
  actor?: string;
  action?: string;
  text?: string | (string | TgEntity)[];
  edited?: string;
  edited_unixtime?: string;
  reply_to_message_id?: number;
  forwarded_from?: string;
  photo?: string;
  file?: string;
  file_name?: string;
  media_type?: string;
  sticker_emoji?: string;
}
interface TgChat {
  name?: string;
  type?: string;
  id?: number;
  messages?: TgMessage[];
}

function flattenText(text: TgMessage['text']): string {
  if (typeof text === 'string') return text;
  if (!Array.isArray(text)) return '';
  return text.map((p) => (typeof p === 'string' ? p : (p.text ?? ''))).join('');
}

function toDate(unix?: string, iso?: string): Date | undefined {
  if (unix && /^\d+$/.test(unix)) return new Date(Number(unix) * 1000);
  if (iso) {
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return d;
  }
  return undefined;
}

function chatsFromJson(data: unknown): TgChat[] {
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.messages)) return [obj as TgChat];
  const chats = (obj.chats as { list?: TgChat[] } | undefined)?.list;
  if (Array.isArray(chats)) return chats.filter((c) => Array.isArray(c.messages));
  return [];
}

export function parseTelegramJson(jsonText: string, filename: string = 'result.json'): NormalizedMessage[] {
  let data: unknown;
  try {
    data = JSON.parse(jsonText.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error(`"${filename}" is not valid JSON. ${TELEGRAM_EXPORT_HELP}`);
  }
  const chats = chatsFromJson(data);
  if (chats.length === 0) {
    throw new Error(`"${filename}" does not look like a Telegram Desktop export (no "messages" array found). ${TELEGRAM_EXPORT_HELP}`);
  }

  const out: NormalizedMessage[] = [];
  for (const chat of chats) {
    const chatName = chat.name ?? filename.replace(/\.[a-z]+$/i, '');
    const msgs = chat.messages ?? [];
    msgs.forEach((m, i) => {
      const index = i + 1;
      const isService = m.type === 'service';
      const attachments: string[] = [];
      if (m.photo) attachments.push(m.photo);
      if (m.file) attachments.push(m.file_name ?? m.file);
      let text = flattenText(m.text).trim();
      if (isService) text = `${m.actor ?? ''} ${m.action ?? 'service message'}`.trim();
      const isMedia = !text && attachments.length > 0;
      if (!text && !isMedia && !isService && !m.sticker_emoji) return;
      out.push({
        id: generateId(),
        sourceType: 'telegram',
        sourceFilename: filename,
        sourceIdentifier: `${filename}#${chat.id ?? 'chat'}-${m.id ?? index}`,
        sender: isService ? '' : (m.from ?? 'Unknown'),
        originalText: text || (m.media_type ? `[${m.media_type}]` : m.sticker_emoji ? `[sticker ${m.sticker_emoji}]` : ''),
        timestamp: toDate(m.date_unixtime, m.date),
        messageIndex: index,
        conversationName: chatName,
        externalId: m.id !== undefined ? String(m.id) : undefined,
        replyToExternalId: m.reply_to_message_id !== undefined ? String(m.reply_to_message_id) : undefined,
        editedAt: toDate(m.edited_unixtime, m.edited),
        isEdited: m.edited ? true : undefined,
        attachments: attachments.length ? attachments : undefined,
        isSystemMessage: isService || undefined,
        isMedia: isMedia || undefined,
        dateOrder: 'dmy',
      });
    });
  }
  return out;
}

/** Telegram HTML title attribute: "25.12.2023 10:30:15 UTC+05:30" */
function parseTelegramHtmlDate(title: string | null): Date | undefined {
  if (!title) return undefined;
  const m = /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})(?:\s+UTC([+-]\d{2}):?(\d{2}))?/.exec(title.trim());
  if (!m) return undefined;
  const [, d, mo, y, hh, mm, ss, tzh, tzm] = m;
  if (tzh) {
    const sign = tzh.startsWith('-') ? -1 : 1;
    const offsetMin = sign * (Math.abs(Number(tzh)) * 60 + Number(tzm ?? 0));
    const utc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm), Number(ss));
    return new Date(utc - offsetMin * 60000);
  }
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm), Number(ss));
}

export function parseTelegramHtml(htmlText: string, filename: string = 'messages.html'): NormalizedMessage[] {
  if (typeof DOMParser === 'undefined') throw new Error('HTML parsing requires a browser environment.');
  // DOMParser yields an inert document: scripts do not run and nothing is fetched.
  const doc = new DOMParser().parseFromString(htmlText, 'text/html');
  doc.querySelectorAll('script, style, iframe, object, embed').forEach((n) => n.remove());

  const nodes = Array.from(doc.querySelectorAll('div.message'));
  if (nodes.length === 0) {
    throw new Error(`"${filename}" does not look like a Telegram Desktop HTML export (no messages found). ${TELEGRAM_EXPORT_HELP}`);
  }
  const chatName = doc.querySelector('.page_header .text.bold')?.textContent?.trim() || filename.replace(/\.[a-z]+$/i, '');

  const out: NormalizedMessage[] = [];
  let lastSender = 'Unknown';
  nodes.forEach((node, i) => {
    const index = i + 1;
    const isService = node.classList.contains('service');
    const fromEl = node.querySelector('.from_name');
    if (fromEl?.textContent?.trim()) lastSender = fromEl.textContent.trim();
    const textEl = node.querySelector('.body > .text, .text');
    let text = textEl ? htmlToText(textEl.innerHTML) : '';
    if (isService) text = node.querySelector('.body')?.textContent?.trim() ?? '';
    const media = node.querySelector('.media_wrap .title, .media_wrap .description, .media_wrap');
    const attachments: string[] = [];
    const mediaTitle = media?.textContent?.trim();
    if (mediaTitle) attachments.push(mediaTitle);
    const dateEl = node.querySelector('.date');
    const replyEl = node.querySelector('.reply_to a[href]');
    const replyHref = replyEl?.getAttribute('href') ?? '';
    const replyId = /go_to_message(\d+)/.exec(replyHref)?.[1];
    const id = node.getAttribute('id')?.replace(/^message/, '');
    if (!text && attachments.length === 0) return;
    out.push({
      id: generateId(),
      sourceType: 'telegram',
      sourceFilename: filename,
      sourceIdentifier: `${filename}#${id ?? index}`,
      sender: isService ? '' : lastSender,
      originalText: text || `[${attachments[0]}]`,
      timestamp: parseTelegramHtmlDate(dateEl?.getAttribute('title') ?? null),
      messageIndex: index,
      conversationName: chatName,
      externalId: id,
      replyToExternalId: replyId,
      attachments: attachments.length ? attachments : undefined,
      isSystemMessage: isService || undefined,
      isMedia: !text && attachments.length > 0 ? true : undefined,
      dateOrder: 'dmy',
    });
  });
  return out;
}
