import type { NormalizedMessage, SourceType } from '@/types';
import { readFileAsText, generateId } from '@/lib/utils';
import JSZip from 'jszip';

import { parseWhatsAppChat } from './whatsapp';
import { parseTelegramJson, parseTelegramHtml, TELEGRAM_EXPORT_HELP } from './telegram';
import { parseSmsExport } from './sms';
import { parseTextFile, parseCsvFile, parseJsonFile, parseEmlFile } from './documents';
import { parsePdfFile } from './pdf';
import { performOCR, isOcrReady } from './ocr';

export {
  parseWhatsAppChat,
  parseTelegramJson,
  parseTelegramHtml,
  TELEGRAM_EXPORT_HELP,
  parseSmsExport,
  parseTextFile,
  parseCsvFile,
  parseJsonFile,
  parseEmlFile,
  parsePdfFile,
  performOCR,
  isOcrReady,
};

export async function parseFile(file: File, sourceType: SourceType): Promise<NormalizedMessage[]> {
  const filename = file.name.toLowerCase();

  // Handle ZIP archives
  if (filename.endsWith('.zip')) {
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(file);
    let allMessages: NormalizedMessage[] = [];

    for (const [name, zipEntry] of Object.entries(zipContent.files)) {
      if (!zipEntry.dir) {
        try {
          const blob = await zipEntry.async('blob');
          const extractedFile = new File([blob], name, { type: 'application/octet-stream' });
          const msgs = await parseFile(extractedFile, sourceType);
          allMessages = allMessages.concat(msgs);
        } catch (e) {
          console.error(`Failed to parse ${name} in zip:`, e);
        }
      }
    }
    return allMessages;
  }

  // Handle PDF documents
  if (filename.endsWith('.pdf')) {
    const arrayBuffer = await file.arrayBuffer();
    return parsePdfFile(arrayBuffer, file.name);
  }

  // Handle images via OCR
  if (file.type.startsWith('image/') || /\.(jpe?g|png|webp|bmp|gif)$/i.test(filename)) {
    const ocrResult = await performOCR(file);
    return [
      {
        id: generateId(),
        originalText: ocrResult.text.trim(),
        sender: 'OCR System',
        timestamp: new Date(),
        sourceType: sourceType === 'circular' ? 'circular' : 'image',
        sourceFilename: file.name,
        sourceIdentifier: `${file.name}#ocr`,
        messageIndex: 1,
        ocrConfidence: ocrResult.confidence,
      },
    ];
  }

  // Text-based files
  const text = await readFileAsText(file);

  switch (sourceType) {
    case 'whatsapp':
      return parseWhatsAppChat(text, file.name);

    case 'telegram':
      if (filename.endsWith('.json')) return parseTelegramJson(text, file.name);
      if (filename.endsWith('.html') || filename.endsWith('.htm')) return parseTelegramHtml(text, file.name);
      // Fallback
      try {
        return parseTelegramJson(text, file.name);
      } catch {
        return parseTelegramHtml(text, file.name);
      }

    case 'sms':
      return parseSmsExport(text, file.name);

    case 'circular':
      if (filename.endsWith('.csv')) return parseCsvFile(text, file.name);
      if (filename.endsWith('.json')) return parseJsonFile(text, file.name);
      return parseTextFile(text, file.name);

    case 'document':
    default:
      if (filename.endsWith('.csv')) return parseCsvFile(text, file.name);
      if (filename.endsWith('.json')) return parseJsonFile(text, file.name);
      if (filename.endsWith('.eml')) return parseEmlFile(text, file.name);
      return parseTextFile(text, file.name);
  }
}
