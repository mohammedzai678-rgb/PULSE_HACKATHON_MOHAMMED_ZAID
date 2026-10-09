import type { Finding, ActionItem, SourceReference, NormalizedMessage } from '@/types';
import { formatDate } from '@/lib/utils';

export function generateExecutiveSummary(
  findings: Finding[],
  actionItems: ActionItem[],
  sources: SourceReference[],
  messages: NormalizedMessage[] = []
): string {
  if (findings.length === 0 && messages.length === 0) {
    return 'No messages or findings were identified for summary.';
  }

  const s4Findings = findings.filter((f) => f.severity === 'S4');
  const s3Findings = findings.filter((f) => f.severity === 'S3');
  const urgentCount = s4Findings.length + s3Findings.length;
  const pendingActions = actionItems.filter((a) => a.status === 'pending');

  const lines: string[] = [];

  // Overview paragraph
  lines.push(
    `Across ${messages.length} processed message${messages.length === 1 ? '' : 's'} from ${sources.length} source${sources.length === 1 ? '' : 's'}, the analysis identified ${findings.length} key finding${findings.length === 1 ? '' : 's'} and ${actionItems.length} actionable item${actionItems.length === 1 ? '' : 's'}.`
  );

  // Critical / High Alerts
  if (urgentCount > 0) {
    lines.push(
      `CRITICAL ATTENTION REQUIRED: ${urgentCount} high-priority alert${urgentCount === 1 ? '' : 's'} detected.`
    );
    s4Findings.slice(0, 3).forEach((f) => {
      const deadlineStr = f.deadline ? ` (Deadline: ${formatDate(f.deadline)})` : '';
      lines.push(`• [CRITICAL] ${f.title}${deadlineStr}: ${f.description}`);
    });
    s3Findings.slice(0, 3).forEach((f) => {
      const deadlineStr = f.deadline ? ` (Deadline: ${formatDate(f.deadline)})` : '';
      lines.push(`• [HIGH] ${f.title}${deadlineStr}: ${f.description}`);
    });
  } else {
    lines.push('No immediate critical emergencies detected. Routine activities and deadlines are on schedule.');
  }

  // Next Pending Steps
  if (pendingActions.length > 0) {
    lines.push(`\nImmediate Next Steps (${pendingActions.length} pending):`);
    pendingActions.slice(0, 4).forEach((a) => {
      const due = a.deadline ? ` (Due: ${formatDate(a.deadline)})` : '';
      lines.push(`- ${a.taskDescription}${due}`);
    });
  }

  return lines.join('\n');
}

export function generateLimitations(findings: Finding[], sources: SourceReference[]): string[] {
  const lims: string[] = [
    'Rule-based local inference: 100% private and on-device. No data was sent to cloud AI servers.',
    'Relative dates (e.g., "tomorrow", "this Friday") are calculated relative to message timestamps or current device time.',
  ];

  if (sources.some((s) => s.sourceType === 'image' || (s.ocrConfidence !== undefined && s.ocrConfidence < 80))) {
    lims.push('Some text was parsed via local OCR engine; low contrast images may contain occasional typographical variances.');
  }

  if (findings.some((f) => f.needsReview)) {
    lims.push('Certain findings have been flagged with "Needs review" where dates or deadlines were ambiguous.');
  }

  return lims;
}

export function extractDecisions(messages: NormalizedMessage[]): string[] {
  const decisions: string[] = [];
  const decisionRegex = /\b(?:decided|agreed|approved|confirmed|final decision|resolved to|concluded that)\b/i;

  for (const m of messages) {
    const sentences = m.originalText.split(/(?<=[.?!])\s+/);
    for (const s of sentences) {
      if (decisionRegex.test(s) && s.length > 15) {
        decisions.push(s.trim());
      }
    }
  }

  return Array.from(new Set(decisions)).slice(0, 5);
}

export function extractUnresolvedQuestions(messages: NormalizedMessage[]): string[] {
  const questions: string[] = [];
  for (const m of messages) {
    const sentences = m.originalText.split(/(?<=[.?!])\s+/);
    for (const s of sentences) {
      if (s.trim().endsWith('?') && s.length > 10) {
        questions.push(`${m.sender ? m.sender + ': ' : ''}"${s.trim()}"`);
      }
    }
  }
  return Array.from(new Set(questions)).slice(0, 5);
}

export function detectConflictingInfo(findings: Finding[]): string[] {
  const conflicts: string[] = [];
  // Detect date conflicts for the same category or title
  const dateMap: Record<string, { date: Date; title: string }> = {};

  for (const f of findings) {
    if (f.deadline) {
      const key = f.title.toLowerCase().slice(0, 20);
      if (dateMap[key]) {
        const prev = dateMap[key];
        if (prev.date.getTime() !== f.deadline.getTime()) {
          conflicts.push(
            `Conflicting dates identified for "${f.title}": ${formatDate(prev.date)} vs ${formatDate(f.deadline)}.`
          );
        }
      } else {
        dateMap[key] = { date: f.deadline, title: f.title };
      }
    }
  }

  return conflicts;
}
