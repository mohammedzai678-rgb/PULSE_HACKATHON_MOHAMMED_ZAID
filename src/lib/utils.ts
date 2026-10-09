import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Generate a unique ID (works in window, worker and test environments) */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function formatDate(date: Date | string | number | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!date) return 'Unknown date';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Unknown date';
  return new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: 'short', day: 'numeric', ...options }).format(d);
}

export function formatDateTime(date: Date | string | number | undefined): string {
  if (!date) return 'Unknown date/time';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Unknown date/time';
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

export function formatRelativeTime(date: Date | string | number | undefined): string {
  if (!date) return 'Unknown time';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  const timestamp = d.getTime();
  if (isNaN(timestamp)) return 'Unknown time';

  const diffSeconds = Math.round((Date.now() - timestamp) / 1000);
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 60 * 60 * 24 * 365],
    ['month', 60 * 60 * 24 * 30],
    ['week', 60 * 60 * 24 * 7],
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
    ['second', 1],
  ];

  for (const [unit, secondsPerUnit] of units) {
    if (Math.abs(diffSeconds) >= secondsPerUnit || unit === 'second') {
      return formatter.format(-Math.round(diffSeconds / secondsPerUnit), unit);
    }
  }

  return 'just now';
}

/** "16:00" -> "4:00 PM" */
export function formatTime24(time?: string): string {
  if (!time) return '';
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return time;
  const h = Number(m[1]);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${suffix}`;
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, Math.max(0, maxLength - 1)).trimEnd() + '…';
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx === -1 ? '' : filename.slice(idx).toLowerCase();
}

export function readFileAsText(file: Blob): Promise<string> {
  return file.text();
}

export function readFileAsArrayBuffer(file: Blob): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

/**
 * Redact one-time-passwords and long card-like numbers.
 * Used for previews and reports so authentication codes are not retained.
 */
export function redactSensitive(text: string): string {
  return text
    .replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, '••••-••••-••••-••••')
    .replace(/\b\d{4,8}\b/g, '••••••');
}

export function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'report';
}

/** Check if a file matches accepted MIME types or file extensions */
export function isValidFileType(file: File, acceptedPatterns: string[]): boolean {
  if (!acceptedPatterns || acceptedPatterns.length === 0) return true;
  if (acceptedPatterns.includes('*/*')) return true;
  const fileName = file.name.toLowerCase();
  const fileType = (file.type || '').toLowerCase();
  return acceptedPatterns.some((pattern) => {
    const p = pattern.toLowerCase().trim();
    if (p.startsWith('.')) {
      return fileName.endsWith(p);
    }
    if (p.endsWith('/*')) {
      const prefix = p.replace('/*', '');
      return fileType.startsWith(prefix);
    }
    return fileType === p;
  });
}
