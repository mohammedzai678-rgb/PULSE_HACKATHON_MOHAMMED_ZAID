import type { Severity, Confidence, ExtractedDateTime, ExtractedEntity, SourceType } from '@/types';

export interface SeverityClassification {
  severity: Severity;
  confidence: Confidence;
  reasoning: string[];
  /** Backwards compatibility string */
  reasoningText: string;
  score: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPREHENSIVE LINGUISTIC PATTERNS & HEURISTICS
// Modeled after CrisisLex, TREC Incident Streams, and Speech Act Classification
// ─────────────────────────────────────────────────────────────────────────────

// Tier 0: Life-Safety, Bereavement & Personal Crises (Immediate S4 Critical)
const BEREAVEMENT_PATTERNS = [
  /\b(?:ur|your|my|our|his|her|their)?\s*(?:father|mother|dad|mom|parent|brother|sister|son|daughter|grandpa|grandma|grandfather|grandmother|uncle|aunt|friend|colleague|cousin|relative|teacher|professor|student)\s+(?:has\s+)?(?:died|passed\s+away|breathed\s+(?:his|her|their)\s+last|expired|is\s+no\s+more|succumbed)\b/i,
  /\b(?:sad\s+demise|untimely\s+demise|tragic\s+death|fatal\s+accident|passed\s+away|deeply\s+saddened\s+to\s+inform|breathed\s+(?:his|her|their)\s+last)\b/i,
  /\b(?:condolence|condolences|obituary|funeral\s+(?:service|prayer|procession)|cremation|memorial\s+service|burial\s+rites)\b/i,
  /\b(?:rest\s+in\s+peace|may\s+(?:his|her|their)\s+soul\s+rest\s+in\s+peace|r\.?i\.?p\.?)\b/i,
  /\b(?:tragic\s+loss|loss\s+of\s+our\s+beloved|homage\s+to\s+the\s+departed)\b/i,
];

const MEDICAL_CRISIS_PATTERNS = [
  /\b(?:urgent(?:ly)?\s+need(?:ed)?|required\s+urgently|emergency\s+requirement)\s+(?:blood|plasma|platelets|oxygen|icu\s+bed|ventilator)\b/i,
  /\b(?:blood\s+(?:needed|required|donor|donation|group|units?)|donor\s+needed|units?\s+of\s+blood)\b/i,
  /\b(?:o|a|b|ab)\s*[+-]\s*(?:ve)?\s*(?:blood|\s+needed|\s+required)\b/i,
  /\b(?:cardiac\s+arrest|heart\s+attack|stroke|brain\s+hemorrhage|major\s+accident|severe\s+trauma|head\s+injury|profuse\s+bleeding)\b/i,
  /\b(?:admitted\s+(?:in|to)\s+(?:icu|emergency|ccu|hospital)|in\s+critical\s+condition|on\s+life\s+support|on\s+ventilator)\b/i,
  /\b(?:ambulance\s+called|call\s+(?:an?\s+)?ambulance|emergency\s+ward|undergoing\s+(?:emergency\s+)?surgery)\b/i,
];

const DISASTER_SAFETY_PATTERNS = [
  /\b(?:fire\s+(?:alarm|breakout|broke\s+out)|building\s+on\s+fire|gas\s+leak|chemical\s+spill|explosion|blast\s+reported)\b/i,
  /\b(?:evacuate\s+(?:immediately|the\s+building|now)|evacuation\s+order|lockdown\s+initiated|shelter\s+in\s+place)\b/i,
  /\b(?:active\s+threat|armed\s+intruder|hostage\s+situation|gunfire|bomb\s+threat)\b/i,
  /\b(?:severe\s+weather\s+warning|cyclone\s+alert|flash\s+flood|earthquake\s+tremors?|structural\s+collapse)\b/i,
  /\b(?:campus\s+closed\s+due\s+to\s+emergency|curfew\s+declared)\b/i,
];

const PERSONAL_CRISIS_PATTERNS = [
  /\b(?:sos\b|help\s+me\s+please|please\s+help\s+me|im\s+stranded|i\s+am\s+stranded|trapped\s+inside)\b/i,
  /\b(?:being\s+followed|unsafe\s+here|threatened|assaulted|robbed|kidnapped)\b/i,
  /\b(?:call\s+the\s+police|dial\s+(?:911|112|100)\s+immediately)\b/i,
];

// Tier 0.5: Acute Mental Health, Suicidal Ideation & Self-Harm (Immediate S4 Critical)
// Based on C-SSRS (Columbia Suicide Severity Rating Scale) & CLPsych Research
const SUICIDE_MENTAL_HEALTH_PATTERNS = [
  /\b(?:i\s+want\s+to\s+suicide|want\s+to\s+commit\s+suicide|going\s+to\s+commit\s+suicide|committing\s+suicide|commit\s+suicide)\b/i,
  /\b(?:i\s+want\s+to\s+die|want\s+to\s+kill\s+myself|going\s+to\s+kill\s+myself|gonna\s+kill\s+myself|kill\s+myself|thinking\s+of\s+killing\s+myself)\b/i,
  /\b(?:end\s+my\s+life|ending\s+my\s+life|end\s+it\s+all|better\s+off\s+dead|wish\s+i\s+was\s+dead|wish\s+i\s+were\s+never\s+born)\b/i,
  /\b(?:hang\s+myself|cut\s+(?:my\s+)?wrists?|take\s+(?:all\s+)?my\s+pills|overdose\s+on\s+pills|jump\s+off\s+a\s+(?:bridge|roof|building))\b/i,
  /\b(?:i\s+dont\s+want\s+to\s+live|don't\s+want\s+to\s+live|cannot\s+live\s+anymore|can't\s+live\s+anymore|no\s+reason\s+to\s+live|tired\s+of\s+living|ready\s+to\s+die)\b/i,
  /\b(?:this\s+is\s+my\s+(?:last|final)\s+(?:message|goodbye|note)|goodbye\s+(?:everyone|cruel\s+world|forever)|forgive\s+me\s+for\s+everything\s+goodbye|won't\s+be\s+here\s+tomorrow|wont\s+be\s+alive\s+tomorrow)\b/i,
  /\b(?:self\s*harm|cutting\s+myself|hurting\s+myself)\b/i,
];

// Metaphorical guards to prevent colloquial / figurative false alarms
const METAPHOR_FALSE_POSITIVES = /\b(?:dead\s+battery|phone\s+(?:died|is\s+dead)|laptop\s+died|killing\s+it|drop\s+dead\s+gorgeous|dying\s+of\s+laughter|sick\s+beat|fire\s+song|heart\s+attack\s+when\s+i\s+saw|murdered\s+the\s+exam|rip\s+my\s+gpa|rip\s+sleep|mock\s+drill|fire\s+drill|simulation\s+only|suicide\s+(?:squad|pass|door|run|mission|bunt|drill))\b/i;

// Tier 1: Severe Consequence & Debarment Patterns
const CONSEQUENCE_PATTERNS = [
  /\b(?:will\s+not\s+be\s+(?:accepted|entertained|considered)|under\s+no\s+circumstances\s+accepted)\b/i,
  /\b(?:failure\s+to\s+(?:comply|submit|pay|attend|register)\s+will\s+result\s+in)\b/i,
  /\b(?:hall\s+tickets?\s+(?:will\s+be\s+withheld|withheld)|admit\s+cards?\s+withheld)\b/i,
  /\b(?:debarred\s+from|detained\s+from|admission\s+(?:will\s+be\s+)?cancel(?:l)?ed)\b/i,
  /\b(?:candidature\s+(?:shall\s+stand\s+cancelled|cancelled)|treated\s+as\s+absent)\b/i,
  /\b(?:strict\s+disciplinary\s+action|heavy\s+penalty|fine\s+will\s+be\s+imposed|police\s+complaint|legal\s+notice)\b/i,
  /\b(?:services?\s+(?:suspended|disconnected)|account\s+(?:frozen|blocked|terminated))\b/i,
];

// Tier 2: Academic & Career High Stakes
const ACADEMIC_STAKES_PATTERNS = [
  /\b(?:hall\s+ticket|admit\s+card|exam\s+form|registration\s+card)\s+(?:download|collection|mandatory)\b/i,
  /\b(?:midterm|semester\s+end|final\s+exam|practical\s+exam|viva\s+voce|online\s+assessment)\b/i,
  /\b(?:project\s+submission|thesis\s+submission|synopsis|capstone|lab\s+record)\b/i,
  /\b(?:campus\s+placement|recruitment\s+drive|interview\s+slot|hiring\s+test|oa\s+link)\b/i,
  /\b(?:tcs|infosys|wipro|cognizant|accenture|google|microsoft|amazon)\s+(?:drive|test|interview)\b/i,
];

// Tier 3: Urgency Adverbs & Directives
const URGENCY_MODIFIERS = /\b(urgent|urgently|emergency|critical|immediate|immediately|mandatory|strictly|vital|compulsory|crucial|last\s+date|cut-off|final\s+reminder|portal\s+closes)\b/i;

const ACTION_VERBS = /\b(submit|complete|pay|register|apply|attend|verify|fill|upload|report\s+to|bring|collect|download|send)\b/i;

export function classifySeverity(
  text: string,
  dates: ExtractedDateTime[],
  entities: ExtractedEntity[],
  sourceType?: SourceType | string
): SeverityClassification {
  const lowerText = text.toLowerCase();
  const reasoning: string[] = [];
  let score = 0;

  const isMetaphor = METAPHOR_FALSE_POSITIVES.test(lowerText);

  // 1. CHECK TIER 0: LIFE-SAFETY, BEREAVEMENT, MENTAL HEALTH & PERSONAL CRISIS (Guaranteed S4)
  const isMentalHealthCrisis = !isMetaphor && SUICIDE_MENTAL_HEALTH_PATTERNS.some((p) => p.test(text));
  const isBereavement = !isMetaphor && BEREAVEMENT_PATTERNS.some((p) => p.test(text));
  const isMedicalEmergency = !isMetaphor && MEDICAL_CRISIS_PATTERNS.some((p) => p.test(text));
  const isDisaster = !isMetaphor && DISASTER_SAFETY_PATTERNS.some((p) => p.test(text));
  const isPersonalCrisis = !isMetaphor && PERSONAL_CRISIS_PATTERNS.some((p) => p.test(text));

  if (isMentalHealthCrisis) {
    score += 100;
    reasoning.push('[Life-Safety Distress Alert] Acute suicidal ideation, self-harm crisis, or finality farewell signal detected. Immediate human intervention and helpline support required.');
  }
  if (isBereavement) {
    score += 100;
    reasoning.push('[Life-Safety Alert] Direct bereavement / death notification detected regarding a family member or close contact.');
  }
  if (isMedicalEmergency) {
    score += 95;
    reasoning.push('[Medical Emergency] Urgent hospital admission, blood donation need, or life-support status identified.');
  }
  if (isDisaster) {
    score += 95;
    reasoning.push('[Hazard Alert] Active campus or environmental threat, evacuation, or safety warning.');
  }
  if (isPersonalCrisis) {
    score += 90;
    reasoning.push('[Personal Crisis] Direct SOS or personal safety distress signal detected.');
  }

  // 2. CHECK TIER 1: SEVERE STATED CONSEQUENCES
  const hasConsequences = CONSEQUENCE_PATTERNS.some((p) => p.test(text));
  if (hasConsequences) {
    score += 45;
    reasoning.push('[Strict Consequence] Explicit negative repercussion stated (e.g. debarment, withholding of hall ticket, cancellation).');
  }

  // 3. CHECK TIER 2: HIGH-STAKES ACADEMIC / CAREER / FINANCIAL
  const hasAcademicStakes = ACADEMIC_STAKES_PATTERNS.some((p) => p.test(text));
  if (hasAcademicStakes) {
    score += 25;
    reasoning.push('[High Stakes] Academic examinations, recruitment drives, or hall ticket requirements identified.');
  }

  const hasFinancials = entities.some((e) => e.type === 'amount') || /\b(fee|fees|payment|tuition|dues|fine|penalty|invoice|salary)\b/i.test(lowerText);
  if (hasFinancials) {
    score += 20;
    reasoning.push('[Financial Factor] Direct monetary transactions, fees, dues, or penalties mentioned.');
  }

  // 4. CHECK URGENCY MODIFIERS & ACTION VERBS
  const hasUrgentKeywords = URGENCY_MODIFIERS.test(lowerText);
  if (hasUrgentKeywords) {
    score += 25;
    reasoning.push('[Urgency Markers] High-priority directive markers present (e.g. urgent, immediately, mandatory, portal closes).');
  }

  const hasActionWords = ACTION_VERBS.test(lowerText);
  if (hasActionWords) {
    score += 15;
    reasoning.push('[Call to Action] Directive imperative verb instructs the recipient to take immediate steps.');
  }

  // 5. TEMPORAL PROXIMITY SCORING (Closer deadline = higher score)
  const deadlineDates = dates.filter((d) => d.kind === 'deadline' || d.kind === 'submission' || (d as any).isDeadline);
  const now = Date.now();
  let closestHoursUntilDeadline = Infinity;

  for (const d of deadlineDates) {
    if (d.date) {
      const diffHours = (d.date.getTime() - now) / (1000 * 60 * 60);
      if (diffHours >= -2 && diffHours < closestHoursUntilDeadline) {
        closestHoursUntilDeadline = diffHours;
      }
    }
  }

  if (closestHoursUntilDeadline <= 6 && closestHoursUntilDeadline >= -2) {
    score += 35;
    reasoning.push('[Imminent Deadline] Action required within the next 6 hours.');
  } else if (closestHoursUntilDeadline <= 24 && closestHoursUntilDeadline > 6) {
    score += 25;
    reasoning.push('[Same-Day Deadline] Action required within 24 hours.');
  } else if (closestHoursUntilDeadline <= 48 && closestHoursUntilDeadline > 24) {
    score += 15;
    reasoning.push('[Near-Term Deadline] Action due tomorrow.');
  } else if (deadlineDates.length > 0) {
    score += 10;
    reasoning.push('[Calendar Milestone] Specific calendar deadline or submission date extracted.');
  }

  // 6. EMOTIONAL & PUNCTUATION INTENSITY
  const words = text.split(/\s+/).filter(Boolean);
  const capsWords = words.filter((w) => w.length > 2 && w === w.toUpperCase() && /[A-Z]/.test(w));
  if (words.length > 3 && capsWords.length / words.length >= 0.35) {
    score += 10;
    reasoning.push('[High Emphasis] High proportion of uppercase lettering indicates urgent broadcast.');
  }
  if (/[!]{2,}|\?{2,}|[!\\?]{3,}/.test(text)) {
    score += 8;
  }
  if (/[🚨⚠️‼️🆘🔥🩸💔⏰]/.test(text)) {
    score += 10;
    reasoning.push('[Visual Alert] Emergency warning emojis detected.');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SEVERITY MAPPING & DEFENSE RULES
  // ─────────────────────────────────────────────────────────────────────────
  let severity: Severity = 'S0';
  let confidence: Confidence = 'medium';

  // Rule 1: Crisis, bereavement, mental health/suicide distress, medical emergency is ALWAYS Critical S4
  if (isMentalHealthCrisis || isBereavement || isMedicalEmergency || isDisaster || isPersonalCrisis) {
    severity = 'S4';
    confidence = 'high';
  }
  // Rule 2: Explicit consequence + (deadline OR urgent modifier) is Critical S4
  else if (hasConsequences && (deadlineDates.length > 0 || hasUrgentKeywords || score >= 65)) {
    severity = 'S4';
    confidence = 'high';
  }
  // Rule 3: High threshold score or imminent deadline
  else if (score >= 75) {
    severity = 'S4';
    confidence = 'high';
  }
  // Rule 4: High urgency (S3) for stated consequences, near deadlines, or exams/placements
  else if (score >= 45 || hasConsequences || (hasAcademicStakes && hasActionWords) || (hasUrgentKeywords && deadlineDates.length > 0)) {
    severity = 'S3';
    confidence = 'high';
  }
  // Rule 5: Moderate urgency (S2) for general tasks, fees, or routine deadlines
  else if (score >= 22 || hasFinancials || hasActionWords || deadlineDates.length > 0) {
    severity = 'S2';
    confidence = 'medium';
  }
  // Rule 6: Low urgency (S1) for meetings, routine updates
  else if (score >= 10 || lowerText.includes('reminder') || lowerText.includes('note') || lowerText.includes('heads up')) {
    severity = 'S1';
    confidence = 'medium';
  }
  // Rule 7: S0 Informational
  else {
    severity = 'S0';
    confidence = 'low';
    reasoning.push('Routine informational communication with no immediate urgency.');
  }

  return {
    severity,
    confidence,
    reasoning,
    reasoningText: reasoning.join(' '),
    score,
  };
}
