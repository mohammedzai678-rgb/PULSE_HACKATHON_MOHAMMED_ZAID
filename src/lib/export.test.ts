import { describe, it, expect } from 'vitest';
import { exportReportToJson, exportReportToMarkdown, exportReportToPdf } from './export';
import type { Report } from '@/types';

const mockReport: Report = {
  id: 'test-1',
  title: 'Test Report',
  generatedAt: new Date('2026-10-09T10:00:00Z'),
  sources: [
    {
      id: 's1',
      sourceType: 'whatsapp',
      filename: 'chat.txt',
      identifier: 'Chat',
      messageCount: 10,
    },
  ],
  conversations: [],
  totalMessagesProcessed: 10,
  totalDocuments: 1,
  findings: [
    {
      id: 'f1',
      title: 'Fee Payment',
      severity: 'S4',
      originalSeverity: 'S4',
      needsReview: false,
      category: 'financial',
      description: 'Last date to pay fee',
      whyItMatters: 'Late fee applies',
      requiredAction: 'Pay immediately',
      sender: 'Admin',
      deadline: new Date('2026-10-15T00:00:00Z'),
      consequence: 'Penalty',
      sourceFilename: 'chat.txt',
      sourceType: 'whatsapp',
      sourceIdentifier: 'chat.txt#1',
      messageIndex: 1,
      originalExcerpt: 'Please pay your dues by Oct 15',
      confidence: 'high',
      reasoning: ['Late fee applies'],
      extractedDates: [],
      extractedEntities: [],
      sourceMessageIds: ['m1'],
      relevance: 'direct',
      isUnread: false,
      duplicateCount: 1,
      priorityScore: 90,
    },
  ],
  actionItems: [
    {
      id: 'a1',
      taskDescription: 'Pay tuition fee',
      kind: 'direct',
      assignedToUser: true,
      severity: 'S4',
      originalSeverity: 'S4',
      priorityScore: 90,
      status: 'pending',
      sourceType: 'whatsapp',
      sender: 'Admin',
      sourceTitle: 'chat.txt',
      sourceIdentifier: 'chat.txt#1',
      originalExcerpt: 'Please pay your dues by Oct 15',
      confidence: 'high',
      explanation: 'Deadline Oct 15',
      findingId: 'f1',
      deadline: new Date('2026-10-15T00:00:00Z'),
    },
  ],
  timeline: [
    {
      id: 't1',
      date: new Date('2026-10-15T00:00:00Z'),
      title: 'Fee Deadline',
      description: 'Last date without penalty',
      kind: 'deadline',
      severity: 'S4',
      state: 'upcoming',
      needsConfirmation: false,
      findingId: 'f1',
      sourceFilename: 'chat.txt',
    },
  ],
  executiveSummary: 'This is a test summary.',
  limitations: ['Only WhatsApp chat parsed'],
  unresolvedQuestions: [],
  conflictingInfo: [],
  decisions: [],
  includeExcerpts: true,
  userNames: [],
};

describe('export utilities', () => {
  it('exports report to JSON string correctly', () => {
    const json = exportReportToJson(mockReport);
    expect(typeof json).toBe('string');
    const parsed = JSON.parse(json);
    expect(parsed.id).toBe('test-1');
    expect(parsed.findings.length).toBe(1);
  });

  it('exports report to Markdown correctly', () => {
    const md = exportReportToMarkdown(mockReport);
    expect(typeof md).toBe('string');
    expect(md).toContain('# Test Report');
    expect(md).toContain('Executive Summary');
    expect(md).toContain('Detailed Findings');
    expect(md).toContain('Action Items');
  });

  it('calls jsPDF when generating PDF', async () => {
    await expect(exportReportToPdf(mockReport)).resolves.not.toThrow();
  });
});
