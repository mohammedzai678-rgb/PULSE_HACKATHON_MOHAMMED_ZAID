# WHAT DID I MISS? — Integration Contracts (READ FIRST)

Project: `c:\Users\moham\Desktop\pulse hackathon` (React 19 + Vite 8 + TS 6 strict, Tailwind v4, zustand, idb, framer-motion, lucide-react 0.500, react-router-dom 7, date-fns 4, tesseract.js 5, pdfjs-dist 4.10, jspdf 3, jszip 3, vitest 4).

## Hackathon brief (MUST be visibly satisfied)
"The Unread Problem — What Did I Miss?" Build a simple AI micro-app that helps users quickly understand and prioritize important information from overwhelming chat conversations. Focus:
1. Summarizing long and **unread** conversations
2. Identifying important messages, **decisions**, and **action items**
3. Prioritizing information based on **urgency and relevance**
4. Highlighting **mentions, deadlines, and tasks the user may have missed**
5. Local-first processing — conversations, data and summaries never leave the device

The "AI" is a transparent, deterministic local rules/heuristics engine. Never call it a generative model. Never call external AI/cloud.

## TS rules
- `strict`, `verbatimModuleSyntax` (use `import type` for types), `erasableSyntaxOnly` (NO enums, NO parameter properties, NO namespaces).
- Path alias `@/` → `src/`.
- `Severity` is a const object + type: values `'S0'..'S4'`. `Severity.S4_CRITICAL === 'S4'`.
- No `any` unless unavoidable. No console logging of message content.

## Source of truth files (do NOT change their exported API; you may ADD exports if truly needed and mention it)
- `src/types/index.ts` — all domain types (NormalizedMessage, Finding, ActionItem, Report, ConversationSummary, AnalysisOptions, AnalysisResult, AppSettings, GmailMessage...)
- `src/lib/store.ts` — zustand stores: `useThemeStore`, `useImportStore` (ImportBatch model, `addBatch` returns null on duplicate fingerprint, `fileFingerprint(file)`), `useAnalysisStore` (`report`, `setRunning/setProgress/setReport/updateFinding/updateAction/markSaved`), `buildReport(result, opts)`, `stripExcerpts`, `useSettingsStore` (`settings`, `update()`, `isOnline`, `offlineReady`, `ocrReady`, `setOcrReady`), `useGmailStore` (token in memory only), `toast.success/error/info/warning`.
- `src/lib/db.ts` — `saveReport, getReport, getAllReports, deleteReport, deleteAllReports, renameReport, getReportCount, getSettings, saveSettings`.
- `src/lib/utils.ts` — `cn, generateId, formatDate, formatDateTime, formatTime24, truncate, formatFileSize, getExtension, readFileAsText, redactSensitive, isoDay, slugify`.
- `src/lib/csv.ts` — `parseCsv, csvToObjects`. `src/lib/sanitize.ts` — `htmlToText` (inert DOMParser).
- UI primitives in `src/components/ui/`: `Button` (variant primary|secondary|ghost|danger, size sm|md|lg, loading, icon), `Card` (hoverable, onClick), `PageHeader` (title, description, backTo, actions, badge), `SeverityBadge` (severity, size, showLabel, needsReview), `DropZone` (acceptedTypes, acceptedExtensions, maxSizeMB, multiple, onFiles, description, icon), `ConfirmDialog` (open,title,description,confirmLabel,variant,onConfirm,onCancel), `EmptyState`, `LoadingScreen`, `Toaster`. Named exports.
- Theme: read `useThemeStore((s)=>s.theme)`; dark classes `bg-dark-panel border-dark-border text-dark-secondary text-dark-accent bg-dark-bg`; light `bg-light-card border-light-border text-light-secondary text-light-accent bg-light-bg`.

## Module APIs (owners implement exactly these)

### Parsers — `src/lib/parsers/index.ts` (owner: Parser agent)
```ts
export interface ParseOutcome { messages: NormalizedMessage[]; warnings: string[]; images: File[]; scannedPdfPages?: number[]; }
export async function parseFile(file: File, sourceType: SourceType, opts?: { maxFileSizeMB?: number; redactSensitive?: boolean }): Promise<ParseOutcome>; // throws Error with user-friendly message for unsupported/malformed
export function parseText(text: string, sourceType: SourceType, label?: string): ParseOutcome; // pasted text; auto-detect WhatsApp format
export const ACCEPT: Record<SourceType, { extensions: string[]; mime: string[]; description: string }>;
```
`src/lib/parsers/ocr.ts`:
```ts
export interface OcrResult { text: string; confidence: number; lines: { text: string; confidence: number; bbox: { x0:number;y0:number;x1:number;y1:number } }[] }
export async function recognizeImage(img: Blob, onProgress?: (pct: number, status: string) => void): Promise<OcrResult>;
export function ocrTextToMessages(text: string, filename: string, sourceType: SourceType, confidence?: number): NormalizedMessage[];
export async function terminateOcr(): Promise<void>;
```
`src/lib/parsers/pdf.ts`:
```ts
export async function extractPdf(buf: ArrayBuffer, filename: string, sourceType: SourceType): Promise<{ messages: NormalizedMessage[]; scannedPages: number[]; pageCount: number }>;
export async function renderPdfPage(buf: ArrayBuffer, pageNumber: number, scale?: number): Promise<Blob>; // for OCR of scanned pages
```

### Analysis — `src/lib/analysis/` (owner: Analysis agent)
```ts
// engine.ts — pure, deterministic, runs in worker or main thread
export function analyzeMessages(messages: NormalizedMessage[], options: AnalysisOptions, onProgress?: (p: AnalysisProgress) => void): AnalysisResult;
// run.ts — UI entry point. Uses a module Web Worker (analysis.worker.ts) and falls back to main thread.
export async function runAnalysis(messages: NormalizedMessage[], options: AnalysisOptions, onProgress: (p: AnalysisProgress) => void): Promise<AnalysisResult>;
// Dates survive worker postMessage (structured clone keeps Date).
```
`src/lib/demo.ts`: `export function getDemoMessages(now?: Date): NormalizedMessage[]` — clearly labelled demonstration data (WhatsApp group, Telegram, SMS incl. an OTP, circular, email).

### Export — `src/lib/export.ts` (owner: Reports agent)
```ts
export async function exportReportToPdf(report: Report): Promise<void>; // lazy import('jspdf')
export function reportToMarkdown(report: Report): string;
export function reportToJson(report: Report): string;
export function downloadFile(content: string | Blob, filename: string, mime: string): void;
```

### Gmail — `src/lib/gmail.ts` (owner: Upload agent)
GIS token client (script `https://accounts.google.com/gsi/client` loaded on demand), scope `https://www.googleapis.com/auth/gmail.readonly`, client id from `import.meta.env.VITE_GOOGLE_CLIENT_ID` or `settings.gmailClientId`. Read-only REST calls to `https://gmail.googleapis.com/gmail/v1/users/me/...`. Never modify mail.

## Routes (App.tsx, owner: lead)
`/`, `/upload`, `/upload/whatsapp|telegram|gmail|sms|circulars|documents|images|other`, `/analysis`, `/reports`, `/reports/:id`, `/settings`. Pages are **default exports** in `src/pages/`.

## Flow
Upload page → parse → `useImportStore.addBatch(...)` with status `ready` + messages → user clicks "Analyze" → navigate `/analysis` → AnalysisPage calls `runAnalysis(useImportStore.getState().getAllMessages(), {userNames, lastReadAt, redactSensitive})` → `buildReport` → `useAnalysisStore.setReport` → user reviews, edits severity/tasks, saves to IndexedDB, exports.
