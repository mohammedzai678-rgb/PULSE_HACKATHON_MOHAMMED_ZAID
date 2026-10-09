import { describe, it, expect, beforeEach } from 'vitest';
import { saveReport, getReport, getAllReports, deleteReport, deleteAllReports, exportDatabaseBackup, importDatabaseBackup } from './db';
import type { Report } from '@/types';

describe('Database & Persistence Architecture (IndexedDB)', () => {
  const dummyReport: Report = {
    id: 'test-report-1',
    title: 'Test Audit Report',
    generatedAt: new Date(),
    sources: [],
    conversations: [],
    totalMessagesProcessed: 5,
    totalDocuments: 1,
    findings: [],
    actionItems: [],
    timeline: [],
    executiveSummary: 'Test executive summary.',
    limitations: [],
    unresolvedQuestions: [],
    conflictingInfo: [],
    decisions: [],
    includeExcerpts: true,
    userNames: [],
  };

  beforeEach(async () => {
    await deleteAllReports();
  });

  it('saves and retrieves a report locally', async () => {
    await saveReport(dummyReport);
    const retrieved = await getReport('test-report-1');

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe('test-report-1');
    expect(retrieved?.title).toBe('Test Audit Report');
  });

  it('exports and imports a complete database backup', async () => {
    await saveReport(dummyReport);
    const backupJson = await exportDatabaseBackup();

    expect(backupJson).toContain('test-report-1');
    expect(backupJson).toContain('Test Audit Report');

    // Clear and restore
    await deleteAllReports();
    const beforeRestore = await getAllReports();
    expect(beforeRestore.length).toBe(0);

    const { restoredReports } = await importDatabaseBackup(backupJson);
    expect(restoredReports).toBe(1);

    const afterRestore = await getReport('test-report-1');
    expect(afterRestore).toBeDefined();
  });

  it('deletes a report properly', async () => {
    await saveReport(dummyReport);
    await deleteReport('test-report-1');
    const result = await getReport('test-report-1');
    expect(result).toBeUndefined();
  });
});
