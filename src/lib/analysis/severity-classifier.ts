import type { Severity, Confidence, ExtractedDateTime, ExtractedEntity, SourceType } from '@/types';

export interface SeverityClassification {
  severity: Severity;
  confidence: Confidence;
  reasoning: string[];
  /** Backwards compatibility string */
  reasoningText: string;
  score: number;
}

export function classifySeverity(
  text: string,
  dates: ExtractedDateTime[],
  entities: ExtractedEntity[],
  sourceType?: SourceType | string
): SeverityClassification {
  const lowerText = text.toLowerCase();
  const reasoning: string[] = [];
  let score = 0;

  const hasUrgentKeywords = /\b(urgent|emergency|critical|immediate|immediately|mandatory|strictly|vital)\b/i.test(lowerText);
  const hasConsequences = /\b(will not be accepted|failure to|withheld|penalt|cancel|cancelled|disqualif|loss of|action will be taken|detained)\b/i.test(lowerText);
  const hasDeadlines = dates.some((d) => d.kind === 'deadline' || d.kind === 'submission' || (d as any).isDeadline);
  const hasEvents = dates.some((d) => d.kind === 'event' || d.kind === 'meeting');
  const hasFinancials = entities.some((e) => e.type === 'amount') || /\b(fee|payment|dues|fine|invoice|salary)\b/i.test(lowerText);
  const hasActionWords = /\b(submit|complete|pay|register|apply|attend|verify|fill|upload|report to)\b/i.test(lowerText);

  // Score accumulation
  if (hasConsequences) {
    score += 50;
    reasoning.push('Explicit negative consequences stated for non-compliance.');
  }
  if (hasUrgentKeywords) {
    score += 35;
    reasoning.push('Contains high-urgency keywords (e.g. mandatory, urgent, immediately).');
  }
  if (hasDeadlines) {
    score += 30;
    reasoning.push('Includes specific calendar or time deadlines.');
  }
  if (hasFinancials) {
    score += 20;
    reasoning.push('Financial transactions, fees, or amounts identified.');
  }
  if (hasActionWords) {
    score += 15;
    reasoning.push('Direct call-to-action detected.');
  }
  if (hasEvents) {
    score += 10;
    reasoning.push('Associated with scheduled meetings or events.');
  }

  let severity: Severity = 'S0';
  let confidence: Confidence = 'medium';

  if (hasConsequences && (hasDeadlines || hasUrgentKeywords)) {
    severity = 'S4';
    confidence = 'high';
  } else if (score >= 60 || (hasUrgentKeywords && hasDeadlines)) {
    severity = 'S4';
    confidence = 'high';
  } else if (score >= 40 || hasDeadlines || hasUrgentKeywords) {
    severity = 'S3';
    confidence = hasDeadlines ? 'high' : 'medium';
  } else if (score >= 20 || hasFinancials || hasActionWords) {
    severity = 'S2';
    confidence = 'medium';
  } else if (score >= 10 || lowerText.includes('reminder') || lowerText.includes('note')) {
    severity = 'S1';
    confidence = 'medium';
  } else {
    severity = 'S0';
    confidence = 'low';
    reasoning.push('Routine informational or background message.');
  }

  return {
    severity,
    confidence,
    reasoning,
    reasoningText: reasoning.join(' '),
    score,
  };
}
