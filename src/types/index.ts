// ============================================================================
// WHAT DID I MISS? — Core Type Definitions
// ============================================================================

/** Severity classification levels (const object: compatible with erasableSyntaxOnly) */
export const Severity = {
  S0_INFORMATIONAL: 'S0',
  S1_LOW: 'S1',
  S2_MODERATE: 'S2',
  S3_HIGH: 'S3',
  S4_CRITICAL: 'S4',
} as const;
export type Severity = (typeof Severity)[keyof typeof Severity];

export const SEVERITY_ORDER: Severity[] = ['S4', 'S3', 'S2', 'S1', 'S0'];

export const SEVERITY_LABELS: Record<Severity, string> = {
  S0: 'Informational',
  S1: 'Low',
  S2: 'Moderate',
  S3: 'High',
  S4: 'Critical',
};

export const SEVERITY_DESCRIPTIONS: Record<Severity, string> = {
  S0: 'General updates, routine announcements or background information.',
  S1: 'Minor reminders, optional events, non-urgent updates or low-impact tasks.',
  S2: 'Tasks needing attention, routine deadlines, requests awaiting a response.',
  S3: 'Near-term deadlines, urgent requests, important schedule changes, missed commitments or stated consequences.',
  S4: 'Explicitly time-critical or potentially serious: credible emergency alert, or an imminent deadline with serious stated consequences.',
};

/** Tailwind classes (text + tinted background) used for badges. Never the only signal: badges also carry text. */
export const SEVERITY_COLORS: Record<Severity, { bg: string; text: string; border: string; dot: string }> = {
  S0: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30', dot: 'bg-slate-400' },
  S1: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30', dot: 'bg-sky-400' },
  S2: { bg: 'bg-yellow-500/10', text: 'text-yellow-500', border: 'border-yellow-500/30', dot: 'bg-yellow-500' },
  S3: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30', dot: 'bg-orange-400' },
  S4: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30', dot: 'bg-red-400' },
};

/** Confidence level for extracted data */
export type Confidence = 'high' | 'medium' | 'low';

/** Source types for imported content */
export type SourceType = 'whatsapp' | 'telegram' | 'gmail' | 'sms' | 'circular' | 'document' | 'image' | 'other';

export const SOURCE_LABELS: Record<SourceType, string> = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  gmail: 'Gmail',
  sms: 'SMS',
  circular: 'Circulars & Notices',
  document: 'Documents',
  image: 'Images',
  other: 'Other',
};

export type ActionItemStatus = 'pending' | 'completed';

/** A normalized message (or document page / section) from any source */
export interface NormalizedMessage {
  id: string;
  sourceType: SourceType;
  /** Source filename, or email subject / "Pasted text" */
  sourceFilename: string;
  /** Stable reference, e.g. `chat.txt#12`, `notice.pdf#p2`, Gmail message id */
  sourceIdentifier: string;
  sender: string;
  recipient?: string;
  subject?: string;
  originalText: string;
  timestamp?: Date;
  /** True when timestamp is a guess (e.g. DD/MM vs MM/DD could not be determined) */
  timestampAssumed?: boolean;
  /** 1-based index within the source (message number, section number or page number) */
  messageIndex: number;
  pageNumber?: number;
  conversationName?: string;
  externalId?: string;
  replyToExternalId?: string;
  editedAt?: Date;
  attachments?: string[];
  isSystemMessage?: boolean;
  isMedia?: boolean;
  isDeleted?: boolean;
  isEdited?: boolean;
  isUnread?: boolean;
  /** Sensitive message kind: content is redacted in previews and reports by default */
  sensitive?: 'otp';
  /** Numeric date order hint for ambiguous dd/mm vs mm/dd inside the text */
  dateOrder?: 'dmy' | 'mdy' | 'unknown';
  /** OCR confidence (0-100) when text came from OCR */
  ocrConfidence?: number;
}

export type DateKind =
  | 'event'
  | 'deadline'
  | 'submission'
  | 'registration'
  | 'meeting'
  | 'reminder'
  | 'publication'
  | 'unknown';

export const DATE_KIND_LABELS: Record<DateKind, string> = {
  event: 'Event date',
  deadline: 'Deadline',
  submission: 'Submission deadline',
  registration: 'Registration deadline',
  meeting: 'Meeting',
  reminder: 'Reminder date',
  publication: 'Publication date',
  unknown: 'Date (purpose unclear)',
};

/** A date/time found in text, with how it was derived. */
export interface ExtractedDateTime {
  id: string;
  /** The exact wording found in the source */
  originalPhrase: string;
  kind: DateKind;
  /** Normalized calendar date (local midnight) when it can be defended */
  date?: Date;
  /** Start time as written, 24h "HH:mm" */
  time?: string;
  endTime?: string;
  timezone?: string;
  /** explicit: stated fully; inferred: derived from a reference (year / weekday / "tomorrow"); ambiguous: unresolved */
  basis: 'explicit' | 'inferred' | 'ambiguous';
  needsConfirmation: boolean;
  /** Human readable explanation of any assumption */
  note?: string;
  sourceMessageId: string;
}

export interface ExtractedEntity {
  id: string;
  type: 'person' | 'organization' | 'location' | 'amount' | 'phone' | 'email' | 'url' | 'reference_number' | 'mention';
  value: string;
  sourceMessageId: string;
}

export type FindingCategory =
  | 'mental_health_crisis'
  | 'bereavement_crisis'
  | 'medical_emergency'
  | 'personal_crisis'
  | 'safety'
  | 'urgent_request'
  | 'deadline'
  | 'upcoming_event'
  | 'meeting'
  | 'decision'
  | 'question_pending'
  | 'task'
  | 'announcement'
  | 'financial'
  | 'exam_assignment'
  | 'internship_placement'
  | 'legal'
  | 'conflict'
  | 'duplicate'
  | 'potentially_missed'
  | 'sensitive'
  | 'general';

export const CATEGORY_LABELS: Record<FindingCategory, string> = {
  mental_health_crisis: 'Mental Health / Suicide Distress Alert',
  bereavement_crisis: 'Bereavement / Death Alert',
  medical_emergency: 'Medical Emergency',
  personal_crisis: 'Personal Crisis / SOS',
  safety: 'Safety / Disaster Alert',
  urgent_request: 'Urgent Request',
  deadline: 'Deadline',
  upcoming_event: 'Upcoming Event',
  meeting: 'Meeting / Schedule',
  decision: 'Decision',
  question_pending: 'Question Awaiting Response',
  task: 'Task / Commitment',
  announcement: 'Announcement',
  financial: 'Financial / Payment',
  exam_assignment: 'Exam / Assignment',
  internship_placement: 'Internship / Placement',
  legal: 'Legal / Disciplinary Notice',
  conflict: 'Conflicting Information',
  duplicate: 'Duplicate',
  potentially_missed: 'Potentially Missed',
  sensitive: 'Sensitive (Redacted)',
  general: 'General Update',
};

/** How this finding relates to the user (only when the user entered their names in Settings) */
export type Relevance = 'direct' | 'mentioned' | 'group' | 'none';

export interface Finding {
  id: string;
  title: string;
  severity: Severity;
  /** Machine classification, kept for auditability when the user overrides */
  originalSeverity: Severity;
  userOverridden?: boolean;
  /** True when information is insufficient for a trustworthy classification */
  needsReview: boolean;
  category: FindingCategory;
  /** EXTRACTED: what the message says (quoted from the source) */
  description: string;
  /** INFERRED: why it matters (rule-based) */
  whyItMatters: string;
  requiredAction: string;
  relevantPerson?: string;
  relevantOrganization?: string;
  sender: string;
  messageDateTime?: Date;
  messageDateAssumed?: boolean;
  /** Event / meeting date-time (from the extracted dates) */
  eventDateTime?: Date;
  deadline?: Date;
  /** Only when stated in the source */
  consequence?: string;
  sourceFilename: string;
  sourceType: SourceType;
  sourceIdentifier: string;
  messageIndex: number;
  pageNumber?: number;
  originalExcerpt: string;
  confidence: Confidence;
  ambiguity?: string;
  /** INFERRED: transparent rule trace explaining the severity */
  reasoning: string[];
  extractedDates: ExtractedDateTime[];
  extractedEntities: ExtractedEntity[];
  sourceMessageIds: string[];
  relevance: Relevance;
  isUnread: boolean;
  duplicateCount: number;
  priorityScore: number;
  userNotes?: string;
}

export type ActionKind = 'direct' | 'group' | 'request' | 'commitment' | 'suggestion' | 'completed';

export const ACTION_KIND_LABELS: Record<ActionKind, string> = {
  direct: 'Direct instruction',
  group: 'Group responsibility',
  request: 'Request',
  commitment: 'Commitment',
  suggestion: 'Suggestion',
  completed: 'Already completed',
};

export interface ActionItem {
  id: string;
  taskDescription: string;
  kind: ActionKind;
  /** Only set when explicitly identifiable in the text */
  responsiblePerson?: string;
  /** True only when the user's name/alias explicitly addresses this task */
  assignedToUser: boolean;
  deadline?: Date;
  deadlineNeedsConfirmation?: boolean;
  deadlinePhrase?: string;
  severity: Severity;
  originalSeverity: Severity;
  priorityScore: number;
  status: ActionItemStatus;
  sourceType: SourceType;
  sender: string;
  sourceTitle: string;
  sourceIdentifier: string;
  originalExcerpt: string;
  confidence: Confidence;
  explanation: string;
  findingId: string;
  userNotes?: string;
  completedAt?: Date;
}

export interface SourceReference {
  id: string;
  sourceType: SourceType;
  filename: string;
  identifier: string;
  messageCount: number;
  dateRange?: { start: Date; end: Date };
  ocrConfidence?: number;
}

export interface ConversationSummary {
  id: string;
  sourceType: SourceType;
  title: string;
  messageCount: number;
  participants: { name: string; count: number }[];
  dateRange?: { start: Date; end: Date };
  unreadCount: number;
  findingCount: number;
  highPriorityCount: number;
  mentionCount: number;
  /** Template-generated digest from extracted facts (not generative AI) */
  digest: string;
  highlights: { findingId: string; title: string; severity: Severity }[];
}

export interface TimelineEntry {
  id: string;
  date: Date;
  time?: string;
  title: string;
  description: string;
  kind: DateKind;
  severity: Severity;
  state: 'past' | 'today' | 'upcoming';
  needsConfirmation: boolean;
  findingId: string;
  sourceFilename: string;
}

export interface Report {
  id: string;
  title: string;
  generatedAt: Date;
  sources: SourceReference[];
  conversations: ConversationSummary[];
  totalMessagesProcessed: number;
  totalDocuments: number;
  findings: Finding[];
  actionItems: ActionItem[];
  timeline: TimelineEntry[];
  executiveSummary: string;
  limitations: string[];
  unresolvedQuestions: string[];
  conflictingInfo: string[];
  decisions: string[];
  includeExcerpts: boolean;
  isDemo?: boolean;
  /** Names the user entered to detect mentions (empty if none) */
  userNames: string[];
  lastReadAt?: Date;
}

export interface StoredReport extends Report {
  updatedAt: Date;
}

export interface AnalysisProgress {
  phase: 'preparing' | 'analyzing' | 'linking' | 'summarizing' | 'done';
  phaseLabel: string;
  current: number;
  total: number;
  percentage: number;
}

export interface AnalysisOptions {
  userNames: string[];
  lastReadAt?: Date;
  redactSensitive: boolean;
  /** Reference "now" for deadline proximity; defaults to current time */
  now?: Date;
}

export interface AnalysisResult {
  findings: Finding[];
  actionItems: ActionItem[];
  timeline: TimelineEntry[];
  sources: SourceReference[];
  conversations: ConversationSummary[];
  executiveSummary: string;
  limitations: string[];
  unresolvedQuestions: string[];
  conflictingInfo: string[];
  decisions: string[];
  totalMessagesProcessed: number;
  totalDocuments: number;
}

export type Theme = 'dark' | 'light';

export interface AppSettings {
  includeExcerptsInReports: boolean;
  maxFileSizeMB: number;
  redactSensitiveContent: boolean;
  /** Names / aliases / phone numbers used to detect mentions (stored locally only) */
  userNames: string[];
}
