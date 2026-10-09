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

  // Reject JSON files explicitly
  if (filename.endsWith('.json')) {
    throw new Error('JSON files are not supported. Please upload plain text, Word (.docx), PowerPoint (.pptx), PDF, or image files.');
  }

  // Handle PDF documents
  if (filename.endsWith('.pdf')) {
    const arrayBuffer = await file.arrayBuffer();
    return parsePdfFile(arrayBuffer, file.name);
  }

  // Handle Word documents (.docx)
  if (filename.endsWith('.docx')) {
    try {
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(file);
      const docXml = await zipContent.file('word/document.xml')?.async('text');
      if (docXml) {
        const text = docXml
          .replace(/<\/w:p>/g, '\n\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        return parseTextFile(text || 'Document content', file.name);
      }
    } catch (e) {
      console.error('Failed to parse docx:', e);
    }
    return parseTextFile(`Document: ${file.name}`, file.name);
  }

  // Handle PowerPoint presentations (.pptx)
  if (filename.endsWith('.pptx')) {
    try {
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(file);
      const slideFiles = Object.keys(zipContent.files).filter(
        (f) => f.startsWith('ppt/slides/slide') && f.endsWith('.xml')
      );
      slideFiles.sort((a, b) => {
        const numA = parseInt(a.replace(/[^0-9]/g, '')) || 0;
        const numB = parseInt(b.replace(/[^0-9]/g, '')) || 0;
        return numA - numB;
      });
      let combinedText = '';
      for (const slidePath of slideFiles) {
        const slideXml = await zipContent.file(slidePath)?.async('text');
        if (slideXml) {
          const slideText = slideXml
            .replace(/<\/a:p>/g, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .trim();
          if (slideText) combinedText += slideText + '\n\n';
        }
      }
      return parseTextFile(combinedText.trim() || 'Presentation content', file.name);
    } catch (e) {
      console.error('Failed to parse pptx:', e);
    }
    return parseTextFile(`Presentation: ${file.name}`, file.name);
  }

  // Handle legacy doc and ppt files
  if (filename.endsWith('.doc') || filename.endsWith('.ppt')) {
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let str = '';
      for (let i = 0; i < bytes.length; i++) {
        const byte = bytes[i];
        if (byte >= 32 && byte <= 126) {
          str += String.fromCharCode(byte);
        } else if (byte === 10 || byte === 13) {
          str += '\n';
        }
      }
      const cleaned = str.replace(/[^\x20-\x7E\n]/g, '').replace(/\n{3,}/g, '\n\n').trim();
      return parseTextFile(cleaned || `Document: ${file.name}`, file.name);
    } catch {
      return parseTextFile(`Document: ${file.name}`, file.name);
    }
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
        sourceType: sourceType === 'other' ? 'other' : sourceType === 'circular' ? 'circular' : 'image',
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
      if (filename.endsWith('.html') || filename.endsWith('.htm')) return parseTelegramHtml(text, file.name);
      return parseTextFile(text, file.name);

    case 'sms':
      return parseSmsExport(text, file.name);

    case 'gmail':
      if (filename.endsWith('.eml')) {
        return parseEmlFile(text, file.name).map((m) => ({ ...m, sourceType: 'gmail' }));
      }
      return parseTextFile(text, file.name).map((m) => ({ ...m, sourceType: 'gmail' }));

    case 'circular':
    case 'document':
    case 'other':
    default:
      if (filename.endsWith('.eml')) return parseEmlFile(text, file.name);
      return parseTextFile(text, file.name);
  }
}
