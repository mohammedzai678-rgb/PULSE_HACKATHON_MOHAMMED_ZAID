import { analyzeMessages } from '../analysis/engine';
import type { NormalizedMessage, AnalysisOptions } from '@/types';

// Web Worker context for heavy multi-pass NLP extraction & categorization
self.onmessage = async (e: MessageEvent<{ id: string; messages: NormalizedMessage[]; options?: AnalysisOptions }>) => {
  const { id, messages, options } = e.data;

  try {
    const result = await analyzeMessages(
      messages,
      (progress) => {
        self.postMessage({ id, type: 'progress', progress });
      },
      options
    );

    self.postMessage({ id, type: 'complete', result });
  } catch (error: any) {
    self.postMessage({
      id,
      type: 'error',
      error: error?.message || 'Worker-based analysis failed to complete',
    });
  }
};
