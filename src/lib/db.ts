import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { StoredReport, AppSettings, Report } from '@/types';

/**
 * IndexedDB persistence. Only reports (analysis output) and settings are stored locally.
 * Raw uploaded files are NEVER written here.
 */
interface WDIMDatabase extends DBSchema {
  reports: {
    key: string;
    value: StoredReport;
    indexes: { 'by-date': Date };
  };
  settings: {
    key: string;
    value: AppSettings;
  };
}

const DB_NAME = 'wdim-db';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<WDIMDatabase>> | null = null;

function getDB(): Promise<IDBPDatabase<WDIMDatabase>> {
  if (!dbPromise) {
    dbPromise = openDB<WDIMDatabase>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('reports')) {
          const store = db.createObjectStore('reports', { keyPath: 'id' });
          store.createIndex('by-date', 'generatedAt');
        }
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
      },
    });
  }
  return dbPromise;
}

/** Defensive: strip anything token-like before persisting. */
function sanitizeForStorage(report: Report): StoredReport {
  const clone = { ...(report as StoredReport) } as StoredReport & Record<string, unknown>;
  delete clone.accessToken;
  delete clone.token;
  return { ...clone, updatedAt: new Date() };
}

export async function saveReport(report: Report): Promise<void> {
  const db = await getDB();
  await db.put('reports', sanitizeForStorage(report));
}

export async function getReport(id: string): Promise<StoredReport | undefined> {
  const db = await getDB();
  return db.get('reports', id);
}

export async function getAllReports(): Promise<StoredReport[]> {
  const db = await getDB();
  const reports = await db.getAll('reports');
  return reports.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
}

export async function deleteReport(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('reports', id);
}

export async function deleteAllReports(): Promise<void> {
  const db = await getDB();
  await db.clear('reports');
}

export async function renameReport(id: string, title: string): Promise<void> {
  const db = await getDB();
  const r = await db.get('reports', id);
  if (!r) return;
  await db.put('reports', { ...r, title, updatedAt: new Date() });
}

export const updateReportTitle = renameReport;

export async function getReportCount(): Promise<number> {
  const db = await getDB();
  return db.count('reports');
}

export async function getSettings(): Promise<AppSettings | undefined> {
  const db = await getDB();
  return db.get('settings', 'app-settings');
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDB();
  await db.put('settings', settings, 'app-settings');
}
