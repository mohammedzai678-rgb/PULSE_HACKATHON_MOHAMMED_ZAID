import type {
  NormalizedMessage,
  Finding,
  ActionItem,
  TimelineEntry,
  SourceReference,
  ConversationSummary,
  AnalysisResult,
  AnalysisProgress,
  AnalysisOptions,
  Severity,
  SourceType,
} from '@/types';
import { extractDates } from './date-extractor';
import { extractEntities } from './entity-extractor';
import { classifySeverity } from './severity-classifier';
import { categorizeMessage } from './categorizer';
import { extractActions } from './action-extractor';
import {
  generateExecutiveSummary,
  generateLimitations,
  extractDecisions,
  extractUnresolvedQuestions,
  detectConflictingInfo,
} from './summarizer';
import { generateId, isoDay, formatDate } from '@/lib/utils';

export function deriveFindingTitle(text: string, category: string, severity: Severity): string {
  const lower = text.toLowerCase();

  if (category === 'bereavement_crisis') {
    if (/\b(?:father|dad)\b/i.test(lower)) return 'CRITICAL: Family Bereavement Alert (Father)';
    if (/\b(?:mother|mom)\b/i.test(lower)) return 'CRITICAL: Family Bereavement Alert (Mother)';
    if (/\b(?:brother|sister|sibling)\b/i.test(lower)) return 'CRITICAL: Family Bereavement Alert (Sibling)';
    if (/\b(?:grandfather|grandpa|grandmother|grandma)\b/i.test(lower)) return 'CRITICAL: Family Bereavement Alert (Grandparent)';
    return 'CRITICAL: Bereavement & Condolence Notice';
  }

  if (category === 'medical_emergency') {
    if (/\bblood\b/i.test(lower)) return 'URGENT: Emergency Blood / Donor Requirement';
    if (/\b(?:icu|cardiac|accident)\b/i.test(lower)) return 'CRITICAL: Emergency Medical Situation';
    return 'CRITICAL: Urgent Medical Alert';
  }

  if (category === 'safety') {
    if (/\bfire\b/i.test(lower)) return 'EMERGENCY: Fire Safety / Evacuation Alert';
    if (/\blockdown\b/i.test(lower)) return 'SECURITY ALERT: Immediate Lockdown Initiated';
    return 'SAFETY ALERT: Emergency Hazard Warning';
  }

  if (category === 'personal_crisis') {
    return 'SOS: Urgent Personal Distress Alert';
  }

  if (category === 'legal') {
    return 'OFFICIAL: Legal / Disciplinary Notice';
  }

  const clean = text.replace(/^(IMPORTANT|URGENT|Reminder|Notice)\s*[-:–—]\s*/i, '').trim();
  const firstSentence = clean.split(/[.?!:\n]/)[0]?.trim() || clean;
  if (firstSentence.length > 5 && firstSentence.length <= 80) {
    return firstSentence;
  }
  if (firstSentence.length > 80) {
    return firstSentence.slice(0, 77) + '…';
  }
  return `${category.replace(/_/g, ' ').toUpperCase()} alert`;
}

export async function analyzeMessages(
  inputMessages: (NormalizedMessage | string | any)[],
  onProgress?: (progress: any) => void,
  options?: AnalysisOptions
): Promise<AnalysisResult> {
  // Normalize all input items to strict NormalizedMessage shape
  const messages: NormalizedMessage[] = inputMessages.map((m, idx) => {
    if (typeof m === 'string') {
      return {
        id: generateId(),
        sourceType: 'other' as const,
        sourceFilename: 'Direct Input',
        sourceIdentifier: `text#${idx + 1}`,
        sender: 'User',
        originalText: m,
        timestamp: new Date(),
        messageIndex: idx + 1,
      };
    }
    return {
      id: m.id || generateId(),
      sourceType: ((m.sourceType || m.source || 'other') as SourceType),
      sourceFilename: m.sourceFilename || m.sourceName || (m.metadata?.fileName) || 'Imported source',
      sourceIdentifier: m.sourceIdentifier || `${m.sourceFilename || 'src'}#${idx + 1}`,
      sender: m.sender || m.from || 'Unknown',
      recipient: m.recipient || m.to,
      subject: m.subject,
      originalText: m.originalText || m.content || m.text || '',
      timestamp: m.timestamp instanceof Date ? m.timestamp : (m.timestamp ? new Date(m.timestamp) : new Date()),
      messageIndex: m.messageIndex ?? idx + 1,
      conversationName: m.conversationName,
      ocrConfidence: m.ocrConfidence,
      sensitive: m.sensitive,
    };
  }).filter((m) => m.originalText.trim().length > 0);

  const reportProgress = (phase: string, current: number, total: number, percent: number) => {
    if (!onProgress) return;
    onProgress({
      phase,
      phaseLabel: phase,
      stage: phase,
      current,
      total,
      percentage: percent,
      percent,
    });
  };

  reportProgress('Preparing data', 0, messages.length, 5);

  const findings: Finding[] = [];
  const actionItems: ActionItem[] = [];
  const timeline: TimelineEntry[] = [];
  const sourcesMap = new Map<string, SourceReference>();
  const conversationsMap = new Map<string, NormalizedMessage[]>();

  const total = messages.length;

  for (let i = 0; i < total; i++) {
    const msg = messages[i];

    // Minimal async yielding to prevent UI freeze on large sets
    if (i % 10 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }

    // 1. Group into source references
    const srcKey = `${msg.sourceType}:${msg.sourceFilename}`;
    if (!sourcesMap.has(srcKey)) {
      sourcesMap.set(srcKey, {
        id: generateId(),
        sourceType: msg.sourceType,
        filename: msg.sourceFilename,
        identifier: msg.sourceIdentifier,
        messageCount: 0,
        ocrConfidence: msg.ocrConfidence,
      });
    }
    const srcRef = sourcesMap.get(srcKey)!;
    srcRef.messageCount += 1;

    // 2. Group into conversations
    const convKey = msg.conversationName || msg.sourceFilename;
    if (!conversationsMap.has(convKey)) {
      conversationsMap.set(convKey, []);
    }
    conversationsMap.get(convKey)!.push(msg);

    // 3. Extract dates & entities
    const extractedDates = extractDates(msg.originalText, msg.timestamp, msg.id);
    const extractedEntities = extractEntities(msg.originalText, msg.id);

    // 4. Classify severity & category
    const { severity, confidence, reasoning, score } = classifySeverity(
      msg.originalText,
      extractedDates,
      extractedEntities,
      msg.sourceType
    );
    const category = categorizeMessage(msg.originalText, extractedDates, extractedEntities);

    // Ensure S4 / S3 / S2 and crisis messages are NEVER filtered out
    const isCrisisCategory = category === 'bereavement_crisis' || category === 'medical_emergency' || category === 'safety' || category === 'personal_crisis';
    const isChitChat = !isCrisisCategory && severity === 'S0' && extractedDates.length === 0 && extractedEntities.length === 0;

    if (!isChitChat || total < 10) {
      const findingId = generateId();
      const title = deriveFindingTitle(msg.originalText, category, severity);
      const deadlineDate = extractedDates.find((d) => d.kind === 'deadline' || d.kind === 'submission' || (d as any).isDeadline)?.date;
      const eventDate = extractedDates.find((d) => d.kind === 'event' || d.kind === 'meeting')?.date;

      const whyItMatters =
        category === 'bereavement_crisis'
          ? 'Critical personal/family life event requiring immediate support, condolence, and presence.'
          : category === 'medical_emergency'
          ? 'Life-safety medical emergency requiring rapid intervention, hospital coordination, or blood donation.'
          : category === 'safety'
          ? 'Physical hazard or disaster alert directly impacting personal safety.'
          : category === 'personal_crisis'
          ? 'Direct SOS distress signal indicating someone is in danger or needs immediate help.'
          : category === 'legal'
          ? 'Formal legal or disciplinary mandate carrying institutional consequences.'
          : reasoning[0] || 'Identified during intelligence parsing.';

      const requiredAction =
        category === 'bereavement_crisis'
          ? 'Reach out immediately to family, offer condolences, and assist with arrangements.'
          : category === 'medical_emergency'
          ? 'Contact hospital/family immediately and provide emergency assistance or blood donation.'
          : category === 'safety'
          ? 'Follow safety or evacuation protocols immediately.'
          : category === 'personal_crisis'
          ? 'Contact individual or dispatch emergency services immediately.'
          : category === 'deadline' || category === 'exam_assignment' || category === 'financial' || category === 'internship_placement'
          ? 'Review requirement and complete necessary action before the deadline.'
          : 'Keep noted for reference.';

      const finding: Finding = {
        id: findingId,
        title,
        severity,
        originalSeverity: severity,
        needsReview: extractedDates.some((d) => d.needsConfirmation),
        category,
        description: msg.originalText,
        whyItMatters,
        requiredAction,
        sender: msg.sender,
        messageDateTime: msg.timestamp,
        eventDateTime: eventDate,
        deadline: deadlineDate,
        sourceFilename: msg.sourceFilename,
        sourceType: msg.sourceType,
        sourceIdentifier: msg.sourceIdentifier,
        messageIndex: msg.messageIndex,
        originalExcerpt: msg.originalText,
        confidence,
        reasoning,
        extractedDates,
        extractedEntities,
        sourceMessageIds: [msg.id],
        relevance: 'direct',
        isUnread: !!msg.isUnread,
        duplicateCount: 1,
        priorityScore: score,
        // Compatibility properties
        ...(msg as any),
        summary: msg.originalText,
      };

      findings.push(finding);

      // 5. Extract actions
      const actions = extractActions(
        msg.originalText,
        extractedDates,
        extractedEntities,
        severity,
        msg.id,
        msg.sourceType,
        msg.sender,
        msg.sourceFilename,
        findingId
      );
      actionItems.push(...actions);

      // 6. Build timeline entries from extracted dates
      for (const d of extractedDates) {
        if (d.date) {
          const isPast = d.date.getTime() < Date.now();
          const isToday = isoDay(d.date) === isoDay(new Date());

          timeline.push({
            id: generateId(),
            date: d.date,
            time: d.time,
            title,
            description: msg.originalText.slice(0, 100) + (msg.originalText.length > 100 ? '…' : ''),
            kind: d.kind,
            severity,
            state: isToday ? 'today' : isPast ? 'past' : 'upcoming',
            needsConfirmation: d.needsConfirmation,
            findingId,
            sourceFilename: msg.sourceFilename,
            // Compatibility alias
            event: `${title} (${formatDate(d.date)})`,
          } as TimelineEntry & { event?: string });
        }
      }
    }

    const currentPercent = 10 + Math.floor(((i + 1) / total) * 75);
    reportProgress('Analyzing messages', i + 1, total, currentPercent);
  }

  // Sort timeline chronologically
  timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Sort findings by severity (S4 down to S0) then score
  findings.sort((a, b) => {
    const sevOrder = { S4: 5, S3: 4, S2: 3, S1: 2, S0: 1 };
    const diff = (sevOrder[b.severity] || 0) - (sevOrder[a.severity] || 0);
    if (diff !== 0) return diff;
    return b.priorityScore - a.priorityScore;
  });

  // Sort action items by priority score
  actionItems.sort((a, b) => b.priorityScore - a.priorityScore);

  reportProgress('Generating executive summary', total, total, 90);

  const sources = Array.from(sourcesMap.values());
  const executiveSummary = generateExecutiveSummary(findings, actionItems, sources, messages);
  const limitations = generateLimitations(findings, sources);
  const decisions = extractDecisions(messages);
  const unresolvedQuestions = extractUnresolvedQuestions(messages);
  const conflictingInfo = detectConflictingInfo(findings);

  // Build Conversation Summaries
  const conversations: ConversationSummary[] = Array.from(conversationsMap.entries()).map(([title, convMsgs]) => {
    const participantCounts: Record<string, number> = {};
    convMsgs.forEach((m) => {
      if (m.sender) {
        participantCounts[m.sender] = (participantCounts[m.sender] || 0) + 1;
      }
    });

    const participants = Object.entries(participantCounts).map(([name, count]) => ({ name, count }));
    const convFindings = findings.filter((f) => f.sourceFilename === title || f.description.includes(title));

    return {
      id: generateId(),
      sourceType: convMsgs[0]?.sourceType || 'other',
      title,
      messageCount: convMsgs.length,
      participants,
      unreadCount: convMsgs.filter((m) => m.isUnread).length,
      findingCount: convFindings.length,
      highPriorityCount: convFindings.filter((f) => f.severity === 'S4' || f.severity === 'S3').length,
      mentionCount: 0,
      digest: `Contains ${convMsgs.length} messages with ${convFindings.length} identified findings.`,
      highlights: convFindings.slice(0, 3).map((f) => ({ findingId: f.id, title: f.title, severity: f.severity })),
    };
  });

  reportProgress('Done', total, total, 100);

  return {
    findings,
    actionItems,
    timeline,
    sources,
    conversations,
    executiveSummary,
    limitations,
    unresolvedQuestions,
    conflictingInfo,
    decisions,
    totalMessagesProcessed: messages.length,
    totalDocuments: sources.length,
  };
}
