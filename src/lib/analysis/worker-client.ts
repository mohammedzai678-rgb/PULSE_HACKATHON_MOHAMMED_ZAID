import type {
  NormalizedMessage,
  AnalysisResult,
  AnalysisProgress,
  AnalysisOptions,
} from '@/types';
import { analyzeMessages } from './engine';

function toDate(val: any): Date | undefined {
  if (!val) return undefined;
  if (val instanceof Date) return val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? undefined : d;
}

export function hydrateAnalysisResult(result: AnalysisResult): AnalysisResult {
  return {
    ...result,
    generatedAt: toDate(result.generatedAt) || new Date(),
    timeRange: {
      start: toDate(result.timeRange?.start),
      end: toDate(result.timeRange?.end),
    },
    findings: (result.findings || []).map((f) => ({
      ...f,
      messageDateTime: toDate(f.messageDateTime),
      eventDateTime: toDate(f.eventDateTime),
      deadline: toDate(f.deadline),
      extractedDates: (f.extractedDates || []).map((d) => ({
        ...d,
        date: toDate(d.date),
      })),
    })),
    actionItems: (result.actionItems || []).map((a) => ({
      ...a,
      dueDate: toDate(a.dueDate),
      completedAt: toDate(a.completedAt),
    })),
    timeline: (result.timeline || []).map((t) => ({
      ...t,
      date: toDate(t.date) || new Date(),
    })),
  };
}

let workerInstance: Worker | null = null;
let isWorkerSupported = typeof window !== 'undefined' && typeof window.Worker !== 'undefined';

function getOrCreateWorker(): Worker | null {
  if (!isWorkerSupported) return null;
  if (!workerInstance) {
    try {
      workerInstance = new Worker(
        new URL('../workers/analysis.worker.ts', import.meta.url),
        { type: 'module' }
      );
    } catch (err) {
      console.warn('Web Worker initialization failed, falling back to main-thread execution:', err);
      isWorkerSupported = false;
      return null;
    }
  }
  return workerInstance;
}

/**
 * Executes the NLP analysis pipeline asynchronously.
 * Offloads compute to a dedicated Web Worker when supported, keeping the UI responsive,
 * and seamlessly falls back to the main thread engine when workers are disabled or unavailable.
 */
export async function analyzeMessagesAsync(
  messages: (NormalizedMessage | string | any)[],
  onProgress?: (progress: AnalysisProgress) => void,
  options?: AnalysisOptions
): Promise<AnalysisResult> {
  const worker = getOrCreateWorker();

  if (!worker) {
    // Direct main-thread execution fallback
    return analyzeMessages(messages, onProgress, options);
  }

  return new Promise<AnalysisResult>((resolve, reject) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const handleMessage = (e: MessageEvent) => {
      const data = e.data;
      if (!data || data.id !== requestId) return;

      if (data.type === 'progress') {
        onProgress?.(data.progress);
      } else if (data.type === 'complete') {
        cleanup();
        try {
          const hydrated = hydrateAnalysisResult(data.result);
          resolve(hydrated);
        } catch {
          resolve(data.result);
        }
      } else if (data.type === 'error') {
        cleanup();
        console.warn('Worker analysis encountered error, falling back to main thread:', data.error);
        analyzeMessages(messages, onProgress, options).then(resolve).catch(reject);
      }
    };

    const handleError = (err: ErrorEvent) => {
      cleanup();
      console.warn('Worker error event triggered, falling back to main thread:', err);
      analyzeMessages(messages, onProgress, options).then(resolve).catch(reject);
    };

    const cleanup = () => {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
    };

    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);

    try {
      worker.postMessage({
        id: requestId,
        messages,
        options,
      });
    } catch (postErr) {
      cleanup();
      console.warn('Failed to postMessage to worker, executing on main thread:', postErr);
      analyzeMessages(messages, onProgress, options).then(resolve).catch(reject);
    }
  });
}
