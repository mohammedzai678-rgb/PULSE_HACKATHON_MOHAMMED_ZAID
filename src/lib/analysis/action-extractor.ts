import type { ActionItem, ExtractedDateTime, ExtractedEntity, Severity, SourceType, ActionKind } from '@/types';
import { generateId } from '@/lib/utils';

export function extractActions(
  text: string,
  dates: ExtractedDateTime[],
  entities: ExtractedEntity[],
  severity: Severity,
  messageId: string,
  sourceType: SourceType,
  sender: string,
  sourceTitle: string,
  findingId: string = ''
): ActionItem[] {
  const actions: ActionItem[] = [];
  const sentences = text.split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter(Boolean);

  const actionPattern = /\b(must\s+\w+|have to\s+\w+|need to\s+\w+|please\s+\w+|required to\s+\w+|ensure that|submit\s+|register\s+|bring\s+|pay\s+|upload\s+|complete\s+|attend\s+|verify\s+|fill\s+|download\s+|contact\s+)/i;

  const priorityScore = severity === 'S4' ? 100 : severity === 'S3' ? 80 : severity === 'S2' ? 50 : 20;

  for (const sentence of sentences) {
    if (actionPattern.test(sentence)) {
      // Find any deadline mentioned in this sentence or globally
      const matchedDate = dates.find((d) => sentence.toLowerCase().includes(d.originalPhrase.toLowerCase())) ||
        dates.find((d) => d.kind === 'deadline' || d.kind === 'submission' || (d as any).isDeadline);

      let kind: ActionKind = 'direct';
      if (/all students|everyone|all members|candidates/i.test(sentence)) {
        kind = 'group';
      } else if (/can you|could you|please/i.test(sentence)) {
        kind = 'request';
      }

      const taskDescription = sentence.replace(/^[•\-\*]\s*/, '').trim();

      actions.push({
        id: generateId(),
        taskDescription,
        // Compatibility alias
        task: taskDescription,
        kind,
        responsiblePerson: undefined,
        assignedToUser: true,
        deadline: matchedDate?.date,
        deadlineNeedsConfirmation: matchedDate?.needsConfirmation,
        deadlinePhrase: matchedDate?.originalPhrase,
        severity,
        originalSeverity: severity,
        priorityScore,
        status: 'pending',
        completed: false,
        sourceType,
        sender,
        sourceTitle,
        sourceIdentifier: messageId,
        originalExcerpt: sentence,
        confidence: 'high',
        explanation: `Extracted from statement by ${sender || 'source'}.`,
        findingId: findingId || generateId(),
      } as ActionItem & { task?: string; completed?: boolean });
    }
  }

  // Fallback 1: Life-safety & Crisis (S4) - Always guarantee an action item for emergencies & bereavement
  if (actions.length === 0 && severity === 'S4') {
    let taskDescription = 'Immediate action required: Review urgent notification and respond.';
    let explanation = 'Life-critical or emergency notification flagged by analysis engine.';

    const lower = text.toLowerCase();
    if (/\b(?:father|mother|dad|mom|died|passed\s+away|demise|death|funeral|cremation|condolence)\b/i.test(lower)) {
      taskDescription = 'Urgent: Contact family, offer condolences, and assist with immediate arrangements.';
      explanation = 'Bereavement notification regarding family or close contact detected.';
    } else if (/\b(?:blood|icu|hospital|ambulance|cardiac|accident|oxygen)\b/i.test(lower)) {
      taskDescription = 'Critical: Coordinate emergency medical aid or verify blood donation requirements.';
      explanation = 'Medical emergency detected.';
    } else if (/\b(?:fire|evacuate|lockdown|active\s+threat|gas\s+leak)\b/i.test(lower)) {
      taskDescription = 'Life Safety: Follow evacuation and emergency safety protocols immediately.';
      explanation = 'Active physical safety or disaster alert detected.';
    } else if (/\b(?:sos|help\s+me|stranded|trapped)\b/i.test(lower)) {
      taskDescription = 'Emergency: Respond to distress call or contact emergency services immediately.';
      explanation = 'Personal SOS distress signal detected.';
    } else {
      taskDescription = text.length > 120 ? text.slice(0, 117) + '...' : text;
      explanation = 'High priority critical requirement.';
    }

    actions.push({
      id: generateId(),
      taskDescription,
      task: taskDescription,
      kind: 'direct',
      assignedToUser: true,
      deadline: dates[0]?.date,
      deadlineNeedsConfirmation: dates[0]?.needsConfirmation,
      deadlinePhrase: dates[0]?.originalPhrase,
      severity: 'S4',
      originalSeverity: 'S4',
      priorityScore: 100,
      status: 'pending',
      completed: false,
      sourceType,
      sender,
      sourceTitle,
      sourceIdentifier: messageId,
      originalExcerpt: text,
      confidence: 'high',
      explanation,
      findingId: findingId || generateId(),
    } as ActionItem & { task?: string; completed?: boolean });
  }
  // Fallback 2: High severity (S3) with deadline
  else if (actions.length === 0 && severity === 'S3' && dates.length > 0) {
    const matchedDate = dates.find((d) => d.kind === 'deadline' || d.kind === 'submission') || dates[0];
    const taskDescription = text.length > 120 ? text.slice(0, 117) + '...' : text;
    actions.push({
      id: generateId(),
      taskDescription,
      task: taskDescription,
      kind: 'direct',
      assignedToUser: true,
      deadline: matchedDate?.date,
      deadlineNeedsConfirmation: matchedDate?.needsConfirmation,
      deadlinePhrase: matchedDate?.originalPhrase,
      severity,
      originalSeverity: severity,
      priorityScore,
      status: 'pending',
      completed: false,
      sourceType,
      sender,
      sourceTitle,
      sourceIdentifier: messageId,
      originalExcerpt: text,
      confidence: 'medium',
      explanation: 'High priority announcement containing key deadline.',
      findingId: findingId || generateId(),
    } as ActionItem & { task?: string; completed?: boolean });
  }

  return actions;
}
