import type { NormalizedMessage } from '@/types';
import { generateId } from '@/lib/utils';
import * as pdfjsLib from 'pdfjs-dist';

// pdfjs-dist setup
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.9.124/build/pdf.worker.min.mjs`;

export async function parsePdfFile(arrayBuffer: ArrayBuffer, filename: string = 'document.pdf'): Promise<NormalizedMessage[]> {
  try {
    const document = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = document.numPages;
    const messages: NormalizedMessage[] = [];

    for (let i = 1; i <= numPages; i++) {
      const page = await document.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str || '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (pageText) {
        messages.push({
          id: generateId(),
          originalText: pageText,
          sender: 'PDF Document',
          timestamp: new Date(),
          sourceType: 'document',
          sourceFilename: filename,
          sourceIdentifier: `${filename}#p${i}`,
          messageIndex: i,
          pageNumber: i,
        });
      }
    }

    return messages;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw error;
  }
}
