import { describe, it, expect } from 'vitest';
import { analyzeMessagesAsync, hydrateAnalysisResult } from './worker-client';
import type { NormalizedMessage } from '@/types';

describe('Web Worker & Async Analysis Pipeline', () => {
  it('correctly executes analyzeMessagesAsync and classifies urgent messages', async () => {
    const messages: NormalizedMessage[] = [
      {
        id: 'msg-async-1',
        sourceType: 'whatsapp',
        sourceFilename: 'chat.txt',
        sourceIdentifier: 'chat#1',
        sender: 'Security Team',
        originalText: 'EMERGENCY: Immediate evacuation required due to chemical leak. Clear all floors.',
        timestamp: new Date('2026-10-09T10:00:00Z'),
        messageIndex: 1,
      },
      {
        id: 'msg-async-2',
        sourceType: 'whatsapp',
        sourceFilename: 'chat.txt',
        sourceIdentifier: 'chat#2',
        sender: 'HR Team',
        originalText: 'Please submit your timesheet before 5:00 PM today.',
        timestamp: new Date('2026-10-09T10:05:00Z'),
        messageIndex: 2,
      },
    ];

    let progressCalls = 0;
    const result = await analyzeMessagesAsync(messages, (p) => {
      progressCalls++;
      expect(p.percentage).toBeGreaterThanOrEqual(0);
    });

    expect(result).toBeDefined();
    expect(result.findings.length).toBeGreaterThanOrEqual(1);
    expect(progressCalls).toBeGreaterThan(0);

    const emergency = result.findings.find((f) => f.severity === 'S4');
    expect(emergency).toBeDefined();
    expect(emergency?.category).toBe('safety');
  });

  it('hydrates serialized date strings into real Date instances safely', () => {
    const rawResult: any = {
      generatedAt: '2026-10-09T12:00:00.000Z',
      timeRange: {
        start: '2026-10-09T10:00:00.000Z',
        end: '2026-10-09T11:00:00.000Z',
      },
      findings: [
        {
          id: 'f-1',
          title: 'Test Finding',
          messageDateTime: '2026-10-09T10:00:00.000Z',
          deadline: '2026-10-10T18:00:00.000Z',
          extractedDates: [
            {
              id: 'd-1',
              originalPhrase: 'tomorrow',
              date: '2026-10-10T00:00:00.000Z',
            },
          ],
        },
      ],
      actionItems: [
        {
          id: 'a-1',
          taskDescription: 'Submit file',
          dueDate: '2026-10-10T18:00:00.000Z',
        },
      ],
      timeline: [
        {
          date: '2026-10-09T10:00:00.000Z',
          summary: 'Event',
        },
      ],
    };

    const hydrated = hydrateAnalysisResult(rawResult);

    expect(hydrated.generatedAt).toBeInstanceOf(Date);
    expect(hydrated.timeRange.start).toBeInstanceOf(Date);
    expect(hydrated.findings[0].messageDateTime).toBeInstanceOf(Date);
    expect(hydrated.findings[0].deadline).toBeInstanceOf(Date);
    expect(hydrated.findings[0].extractedDates[0].date).toBeInstanceOf(Date);
    expect(hydrated.actionItems[0].dueDate).toBeInstanceOf(Date);
    expect(hydrated.timeline[0].date).toBeInstanceOf(Date);
  });
});
