import { create } from 'zustand';
import type {
  Theme,
  SourceType,
  NormalizedMessage,
  AnalysisProgress,
  AnalysisResult,
  Report,
  AppSettings,
  Finding,
  ActionItem,
  GmailMessage,
} from '@/types';
import { generateId } from './utils';
import { getSettings, saveSettings } from './db';

// ── Theme ────────────────────────────────────────────────────────────────────

interface ThemeStore {
  theme: Theme;
  isDarkMode: boolean;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const initialTheme = ((): Theme => {
  try {
    return (localStorage.getItem('wdim-theme') as Theme) || 'dark';
  } catch {
    return 'dark';
  }
})();

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: initialTheme,
  isDarkMode: initialTheme === 'dark',
  isDark: initialTheme === 'dark',
  setTheme: (theme) => {
    try {
      localStorage.setItem('wdim-theme', theme);
    } catch {
      /* ignore */
    }
    set({ theme, isDarkMode: theme === 'dark', isDark: theme === 'dark' });
  },
  toggleTheme: () => {
    const nextTheme: Theme = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(nextTheme);
  },
}));

// ── Import batches ───────────────────────────────────────────────────────────

export type BatchStatus = 'pending' | 'processing' | 'completed' | 'ready' | 'error';

export interface ImportBatch {
  id: string;
  sourceType: SourceType;
  /** Alias for sourceType */
  source?: SourceType;
  /** Filename, "Pasted text", email subject, etc. */
  label: string;
  /** Alias for label */
  name?: string;
  fingerprint?: string;
  file?: File;
  type?: string;
  size?: number;
  status: BatchStatus;
  error?: string;
  warnings?: string[];
  messages: NormalizedMessage[];
  ocrText?: string;
  ocrConfidence?: number;
  previewUrl?: string;
  extractedImages?: File[];
}

export interface PastedTextItem {
  id: string;
  content: string;
  source: SourceType;
  messages: NormalizedMessage[];
}

interface ImportStore {
  batches: ImportBatch[];
  /** Reactively mirrored files for file-list components */
  files: ImportBatch[];
  /** Ready-to-analyze normalized messages across all sources */
  messages: NormalizedMessage[];
  /** Pasted text entries */
  pastedTexts: PastedTextItem[];

  // Core Batch Operations
  addBatch: (b: Omit<ImportBatch, 'id' | 'messages' | 'status'> & Partial<Pick<ImportBatch, 'messages' | 'status'>>) => string | null;
  updateBatch: (id: string, patch: Partial<ImportBatch>) => void;
  removeBatch: (id: string) => void;
  clearSource: (sourceType: SourceType) => void;
  clearAll: () => void;
  getAllMessages: () => NormalizedMessage[];
  hasFingerprint: (fp: string) => boolean;

  // Convenience API used by upload pages
  addFiles: (files: File[], source: SourceType) => void;
  updateFileStatus: (id: string, status: BatchStatus, messages?: NormalizedMessage[], error?: string) => void;
  addPastedText: (text: string, source: SourceType, messages?: NormalizedMessage[]) => void;
  removeFile: (id: string) => void;
  getPendingFiles: () => ImportBatch[];
  addMessages: (msgs: NormalizedMessage[]) => void;
  addMessage: (msg: any) => void;
  clearMessages: () => void;
}

export function fileFingerprint(f: File): string {
  return `${f.name}|${f.size}|${f.lastModified}`;
}

function syncDerivedState(batches: ImportBatch[], pastedTexts: PastedTextItem[]) {
  const readyMessages = [
    ...batches.filter((b) => b.status === 'completed' || b.status === 'ready').flatMap((b) => b.messages),
    ...pastedTexts.flatMap((p) => p.messages),
  ];
  return {
    batches,
    files: batches,
    messages: readyMessages,
    pastedTexts,
  };
}

export const useImportStore = create<ImportStore>((set, get) => ({
  batches: [],
  files: [],
  messages: [],
  pastedTexts: [],

  addBatch: (b) => {
    if (b.fingerprint && get().hasFingerprint(b.fingerprint)) return null;
    const id = generateId();
    const label = b.label || b.name || 'Unnamed file';
    const st: SourceType = (b.sourceType || b.source || 'other') as SourceType;
    const newBatch: ImportBatch = {
      ...b,
      id,
      label,
      name: b.name || label,
      sourceType: st,
      source: st,
      messages: b.messages || [],
      status: b.status || 'pending',
    };
    const nextBatches = [...get().batches, newBatch];
    set(syncDerivedState(nextBatches, get().pastedTexts));
    return id;
  },

  updateBatch: (id, patch) => {
    const nextBatches: ImportBatch[] = get().batches.map((x) => {
      if (x.id !== id) return x;
      const label = patch.label || patch.name || x.label || 'Unnamed file';
      const st = (patch.sourceType || patch.source || x.sourceType || 'other') as SourceType;
      return {
        ...x,
        ...patch,
        label,
        name: patch.name || label,
        source: st,
        sourceType: st,
      };
    });
    set(syncDerivedState(nextBatches, get().pastedTexts));
  },

  removeBatch: (id) => {
    const target = get().batches.find((x) => x.id === id);
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
    const nextBatches = get().batches.filter((x) => x.id !== id);
    set(syncDerivedState(nextBatches, get().pastedTexts));
  },

  clearSource: (sourceType) => {
    get().batches.filter((x) => (x.sourceType === sourceType || x.source === sourceType) && x.previewUrl).forEach((x) => URL.revokeObjectURL(x.previewUrl!));
    const nextBatches = get().batches.filter((x) => x.sourceType !== sourceType && x.source !== sourceType);
    const nextPasted = get().pastedTexts.filter((p) => p.source !== sourceType);
    set(syncDerivedState(nextBatches, nextPasted));
  },

  clearAll: () => {
    get().batches.forEach((x) => x.previewUrl && URL.revokeObjectURL(x.previewUrl));
    set({ batches: [], files: [], messages: [], pastedTexts: [] });
  },

  getAllMessages: () => get().messages,

  hasFingerprint: (fp) => get().batches.some((b) => b.fingerprint === fp),

  addFiles: (files, source) => {
    const newBatches: ImportBatch[] = files.map((file) => ({
      id: generateId(),
      file,
      name: file.name,
      label: file.name,
      size: file.size,
      type: file.type,
      sourceType: source,
      source: source,
      status: 'pending',
      messages: [],
      fingerprint: fileFingerprint(file),
    }));
    const nextBatches = [...get().batches, ...newBatches];
    set(syncDerivedState(nextBatches, get().pastedTexts));
  },

  updateFileStatus: (id, status, messages = [], error) => {
    get().updateBatch(id, {
      status,
      messages,
      error,
    });
  },

  addPastedText: (text, source, messages = []) => {
    const normalizedMsgs = messages.length > 0 ? messages : [{
      id: generateId(),
      sourceType: source,
      sourceFilename: 'Pasted text',
      sourceIdentifier: `pasted#${Date.now()}`,
      sender: 'User',
      originalText: text,
      timestamp: new Date(),
      messageIndex: 1,
    }];
    const item: PastedTextItem = {
      id: generateId(),
      content: text,
      source,
      messages: normalizedMsgs,
    };
    const nextPasted = [...get().pastedTexts, item];
    set(syncDerivedState(get().batches, nextPasted));
  },

  removeFile: (id) => {
    get().removeBatch(id);
  },

  getPendingFiles: () => {
    return get().batches.filter((b) => b.status === 'pending');
  },

  addMessages: (msgs) => {
    const syntheticBatch: ImportBatch = {
      id: generateId(),
      label: 'Imported Messages',
      name: 'Imported Messages',
      sourceType: msgs[0]?.sourceType || 'other',
      source: msgs[0]?.sourceType || 'other',
      status: 'completed',
      messages: msgs,
    };
    const nextBatches = [...get().batches, syntheticBatch];
    set(syncDerivedState(nextBatches, get().pastedTexts));
  },

  addMessage: (msg) => {
    const normalized: NormalizedMessage = {
      id: msg.id || generateId(),
      sourceType: msg.sourceType || 'other',
      sourceFilename: msg.sourceFilename || msg.sourceName || 'Imported message',
      sourceIdentifier: msg.sourceIdentifier || msg.id || generateId(),
      sender: msg.sender || msg.from || 'Unknown',
      recipient: msg.recipient || msg.to,
      subject: msg.subject,
      originalText: msg.originalText || msg.content || msg.text || '',
      timestamp: msg.timestamp ? (msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp)) : new Date(),
      messageIndex: 1,
    };
    get().addMessages([normalized]);
  },

  clearMessages: () => {
    get().clearAll();
  },
}));

// ── Analysis ─────────────────────────────────────────────────────────────────

interface AnalysisStore {
  status: 'idle' | 'running' | 'done' | 'error';
  progress: AnalysisProgress | null;
  error?: string;
  report: Report | null;
  /** Alias for report */
  currentReport: Report | null;
  savedReportId?: string;
  setRunning: () => void;
  setProgress: (p: AnalysisProgress) => void;
  setError: (e: string) => void;
  setReport: (r: Report) => void;
  /** Alias for setReport */
  setCurrentReport: (r: Report) => void;
  markSaved: (id: string) => void;
  updateFinding: (id: string, patch: Partial<Finding>) => void;
  updateAction: (id: string, patch: Partial<ActionItem>) => void;
  reset: () => void;
}

export const useAnalysisStore = create<AnalysisStore>((set) => ({
  status: 'idle',
  progress: null,
  report: null,
  currentReport: null,
  setRunning: () => set({ status: 'running', progress: null, error: undefined, savedReportId: undefined }),
  setProgress: (progress) => set({ progress }),
  setError: (error) => set({ status: 'error', error }),
  setReport: (report) => set({ report, currentReport: report, status: 'done', progress: null }),
  setCurrentReport: (report) => set({ report, currentReport: report, status: 'done', progress: null }),
  markSaved: (savedReportId) => set({ savedReportId }),
  updateFinding: (id, patch) =>
    set((s) => {
      if (!s.report) return s;
      const updated = { ...s.report, findings: s.report.findings.map((f) => (f.id === id ? { ...f, ...patch } : f)) };
      return { report: updated, currentReport: updated };
    }),
  updateAction: (id, patch) =>
    set((s) => {
      if (!s.report) return s;
      const updated = { ...s.report, actionItems: s.report.actionItems.map((a) => (a.id === id ? { ...a, ...patch } : a)) };
      return { report: updated, currentReport: updated };
    }),
  reset: () => set({ status: 'idle', progress: null, report: null, currentReport: null, error: undefined, savedReportId: undefined }),
}));

/** Convert an AnalysisResult into a Report object (not yet persisted). */
export function buildReport(result: AnalysisResult, opts: { title: string; includeExcerpts: boolean; userNames: string[]; isDemo?: boolean; lastReadAt?: Date }): Report {
  const report: Report = {
    id: generateId(),
    title: opts.title,
    generatedAt: new Date(),
    sources: result.sources,
    conversations: result.conversations,
    totalMessagesProcessed: result.totalMessagesProcessed,
    totalDocuments: result.totalDocuments,
    findings: result.findings,
    actionItems: result.actionItems,
    timeline: result.timeline,
    executiveSummary: result.executiveSummary,
    limitations: result.limitations,
    unresolvedQuestions: result.unresolvedQuestions,
    conflictingInfo: result.conflictingInfo,
    decisions: result.decisions,
    includeExcerpts: opts.includeExcerpts,
    isDemo: opts.isDemo,
    userNames: opts.userNames,
    lastReadAt: opts.lastReadAt,
  };
  return opts.includeExcerpts ? report : stripExcerpts(report);
}

/** Remove original message text from a report (user opted out of storing excerpts). */
export function stripExcerpts(r: Report): Report {
  return {
    ...r,
    includeExcerpts: false,
    findings: r.findings.map((f) => ({ ...f, originalExcerpt: '', description: f.title })),
    actionItems: r.actionItems.map((a) => ({ ...a, originalExcerpt: '' })),
  };
}

// ── Settings / environment ───────────────────────────────────────────────────

export const DEFAULT_SETTINGS: AppSettings = {
  includeExcerptsInReports: true,
  maxFileSizeMB: 50,
  redactSensitiveContent: true,
  userNames: [],
};

interface SettingsStore {
  settings: AppSettings;
  loaded: boolean;
  isOnline: boolean;
  offlineReady: boolean;
  ocrReady: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<AppSettings>) => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  setOnline: (v: boolean) => void;
  setOfflineReady: (v: boolean) => void;
  setOcrReady: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
  offlineReady: false,
  ocrReady: (() => {
    try {
      return localStorage.getItem('wdim-ocr-ready') === '1';
    } catch {
      return false;
    }
  })(),
  load: async () => {
    try {
      const s = await getSettings();
      set({ settings: { ...DEFAULT_SETTINGS, ...s }, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  update: async (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    try {
      await saveSettings(next);
    } catch {
      /* storage unavailable — keep in memory */
    }
  },
  updateSettings: async (patch) => {
    return get().update(patch);
  },
  setOnline: (isOnline) => set({ isOnline }),
  setOfflineReady: (offlineReady) => set({ offlineReady }),
  setOcrReady: (ocrReady) => {
    try {
      localStorage.setItem('wdim-ocr-ready', ocrReady ? '1' : '0');
    } catch {
      /* ignore */
    }
    set({ ocrReady });
  },
}));

// ── Gmail (memory only — tokens are never persisted) ─────────────────────────

interface GmailStore {
  accessToken: string | null;
  tokenExpiresAt: number | null;
  userEmail?: string;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  messages: GmailMessage[];
  selectedIds: string[];
  lastRefresh?: Date;
  setToken: (token: string | null, expiresInSec?: number) => void;
  setUserEmail: (email?: string) => void;
  setMessages: (m: GmailMessage[]) => void;
  setLastRefresh: (d: Date) => void;
  toggleSelected: (id: string) => void;
  setSelected: (ids: string[]) => void;
  connect: () => Promise<void>;
  disconnect: () => void;
  fetchMessages: (query?: string) => Promise<void>;
}

export const useGmailStore = create<GmailStore>((set, get) => ({
  accessToken: null,
  tokenExpiresAt: null,
  isConnected: false,
  isLoading: false,
  error: null,
  messages: [],
  selectedIds: [],
  setToken: (accessToken, expiresInSec) =>
    set({
      accessToken,
      isConnected: !!accessToken,
      tokenExpiresAt: accessToken && expiresInSec ? Date.now() + expiresInSec * 1000 : null,
    }),
  setUserEmail: (userEmail) => set({ userEmail }),
  setMessages: (messages) => set({ messages }),
  setLastRefresh: (lastRefresh) => set({ lastRefresh }),
  toggleSelected: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id) ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id],
    })),
  setSelected: (selectedIds) => set({ selectedIds }),
  connect: async () => {
    set({ isLoading: true, error: null });
    try {
      // In web applications, standard Google OAuth client flow:
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (!clientId) {
        throw new Error('Google Client ID not configured.');
      }
      // Demo/Fallback simulated auth token if running without OAuth server redirect
      set({
        isConnected: true,
        accessToken: 'demo-local-token',
        userEmail: 'user@example.com',
        isLoading: false,
      });
    } catch (e: any) {
      set({ isLoading: false, error: e.message || 'Connection failed' });
      throw e;
    }
  },
  disconnect: () =>
    set({
      accessToken: null,
      tokenExpiresAt: null,
      isConnected: false,
      userEmail: undefined,
      messages: [],
      selectedIds: [],
      lastRefresh: undefined,
      error: null,
    }),
  fetchMessages: async (query?: string) => {
    set({ isLoading: true, error: null });
    try {
      // Simulated message fetch for privacy-first inbox reading
      const dummy: GmailMessage[] = [
        {
          id: 'gmail-1',
          threadId: 'th-1',
          subject: 'Important: Project Submission Deadline Extended',
          from: 'head.department@college.edu',
          to: 'me@example.com',
          date: new Date(),
          snippet: 'Please note the AI Capstone project deadline is extended to October 25, 2026.',
          body: 'Dear Students,\n\nPlease note the AI Capstone project deadline is extended to October 25, 2026. Submit your final report via the portal before 6 PM.\n\nRegards,\nHOD',
          isUnread: true,
          attachments: [],
        },
        {
          id: 'gmail-2',
          threadId: 'th-2',
          subject: 'Fee Payment Receipt and Hall Ticket Notification',
          from: 'accounts@college.edu',
          to: 'me@example.com',
          date: new Date(Date.now() - 86400000),
          snippet: 'Your semester exam hall ticket is available for download.',
          body: 'Dear Student,\n\nExam hall tickets have been generated. Verify your registered subjects immediately.\n\nAccounts Office',
          isUnread: false,
          attachments: [],
        },
      ];
      const filtered = query
        ? dummy.filter((m) => m.subject.toLowerCase().includes(query.toLowerCase()) || m.snippet.toLowerCase().includes(query.toLowerCase()))
        : dummy;
      set({ messages: filtered, isLoading: false, lastRefresh: new Date() });
    } catch (e: any) {
      set({ isLoading: false, error: e.message || 'Failed to fetch messages' });
    }
  },
}));

// ── Toasts ───────────────────────────────────────────────────────────────────

export interface Toast {
  id: string;
  message: string;
  title?: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (t: any, legacyType?: Toast['type']) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (t: any, legacyType?: Toast['type']) => {
    const id = generateId();
    let message = '';
    let title: string | undefined = undefined;
    let type: Toast['type'] = legacyType || 'info';
    let duration = 4500;

    if (typeof t === 'string') {
      message = t;
    } else if (typeof t === 'object' && t !== null) {
      message = t.message || t.title || '';
      title = t.title;
      if (t.type) type = t.type;
      if (t.duration) duration = t.duration;
    }

    set((s) => ({ toasts: [...s.toasts.slice(-4), { id, message, title, type, duration }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
    }, duration);
  },
  removeToast: (id: string) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export const toast = {
  success: (message: string) => useToastStore.getState().addToast({ message, type: 'success' }),
  error: (message: string) => useToastStore.getState().addToast({ message, type: 'error', duration: 7000 }),
  info: (message: string) => useToastStore.getState().addToast({ message, type: 'info' }),
  warning: (message: string) => useToastStore.getState().addToast({ message, type: 'warning', duration: 6000 }),
};
