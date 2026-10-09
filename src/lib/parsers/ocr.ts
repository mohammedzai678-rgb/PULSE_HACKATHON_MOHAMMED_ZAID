import Tesseract from 'tesseract.js';

let isReady = true;

export async function performOCR(
  imageFile: File,
  onProgress?: (progress: number) => void
): Promise<{ text: string; confidence: number }> {
  try {
    const worker = await Tesseract.createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress && typeof m.progress === 'number') {
          onProgress(m.progress);
        }
      },
    });

    const imageUrl = URL.createObjectURL(imageFile);
    try {
      const result = await worker.recognize(imageUrl);
      return {
        text: (result.data.text || '').trim(),
        confidence: Math.round(result.data.confidence || 0),
      };
    } finally {
      await worker.terminate();
      URL.revokeObjectURL(imageUrl);
    }
  } catch (error) {
    console.error('OCR Error:', error);
    throw new Error(error instanceof Error ? error.message : 'OCR processing failed');
  }
}

export function isOcrReady(): boolean {
  return isReady;
}
