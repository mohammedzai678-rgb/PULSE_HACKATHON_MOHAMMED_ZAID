import { SEVERITY_LABELS, SEVERITY_COLORS, type Severity } from '@/types';
import { cn } from '@/lib/utils';

export function normalizeSeverity(raw?: string): Severity {
  if (!raw) return 'S0';
  const upper = raw.toUpperCase();
  if (upper === 'S4' || upper === 'CRITICAL' || upper === 'S4_CRITICAL') return 'S4';
  if (upper === 'S3' || upper === 'HIGH' || upper === 'S3_HIGH') return 'S3';
  if (upper === 'S2' || upper === 'MEDIUM' || upper === 'MODERATE' || upper === 'S2_MODERATE') return 'S2';
  if (upper === 'S1' || upper === 'LOW' || upper === 'S1_LOW') return 'S1';
  if (upper === 'S0' || upper === 'INFO' || upper === 'INFORMATIONAL' || upper === 'S0_INFORMATIONAL') return 'S0';
  return 'S0';
}

interface SeverityBadgeProps {
  severity: Severity | string;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  needsReview?: boolean;
  className?: string;
}

/** Severity is conveyed by text (S-code + label) and a shape marker, never by color alone. */
export function SeverityBadge({ severity: rawSeverity, size = 'sm', showLabel = true, needsReview, className }: SeverityBadgeProps) {
  const severity = normalizeSeverity(rawSeverity);
  const c = SEVERITY_COLORS[severity] || SEVERITY_COLORS['S0'];
  const label = SEVERITY_LABELS[severity] || 'Informational';
  const bars = Number(severity.slice(1)) || 0;

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn('inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap', c.bg, c.text, c.border, size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm')}
        aria-label={`Severity ${severity}: ${label}`}
        title={`Severity ${severity}: ${label}`}
      >
        <span aria-hidden className="inline-flex items-end gap-px h-2.5">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={cn('w-0.5 rounded-sm', i < bars ? c.dot : 'bg-current opacity-20')} style={{ height: `${(i + 1) * 25}%` }} />
          ))}
        </span>
        <span>{severity}</span>
        {showLabel && <span>· {label}</span>}
      </span>
      {needsReview && (
        <span className="rounded-full border border-dashed border-amber-500/50 px-2 py-0.5 text-xs text-amber-500" title="Insufficient information for a confident classification">
          Needs review
        </span>
      )}
    </span>
  );
}

export default SeverityBadge;
