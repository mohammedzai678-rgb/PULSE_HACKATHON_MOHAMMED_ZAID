import type { FindingCategory, ExtractedDateTime, ExtractedEntity } from '@/types';

export function categorizeMessage(
  text: string,
  dates: ExtractedDateTime[],
  entities: ExtractedEntity[]
): FindingCategory {
  const lower = text.toLowerCase();

  // 1. Acute Mental Health, Suicidal Ideation & Self-Harm (Absolute Highest Priority)
  if (
    /\b(?:i\s+want\s+to\s+suicide|want\s+to\s+commit\s+suicide|going\s+to\s+commit\s+suicide|committing\s+suicide|commit\s+suicide)\b/i.test(lower) ||
    /\b(?:i\s+want\s+to\s+die|want\s+to\s+kill\s+myself|going\s+to\s+kill\s+myself|gonna\s+kill\s+myself|kill\s+myself|thinking\s+of\s+killing\s+myself)\b/i.test(lower) ||
    /\b(?:end\s+my\s+life|ending\s+my\s+life|end\s+it\s+all|better\s+off\s+dead|wish\s+i\s+was\s+dead|wish\s+i\s+were\s+never\s+born)\b/i.test(lower) ||
    /\b(?:hang\s+myself|cut\s+(?:my\s+)?wrists?|take\s+(?:all\s+)?my\s+pills|overdose\s+on\s+pills|jump\s+off\s+a\s+(?:bridge|roof|building))\b/i.test(lower) ||
    /\b(?:i\s+dont\s+want\s+to\s+live|don't\s+want\s+to\s+live|cannot\s+live\s+anymore|can't\s+live\s+anymore|no\s+reason\s+to\s+live|tired\s+of\s+living|ready\s+to\s+die)\b/i.test(lower) ||
    /\b(?:this\s+is\s+my\s+(?:last|final)\s+(?:message|goodbye|note)|goodbye\s+(?:everyone|cruel\s+world|forever)|forgive\s+me\s+for\s+everything\s+goodbye|won't\s+be\s+here\s+tomorrow|wont\s+be\s+alive\s+tomorrow)\b/i.test(lower) ||
    /\b(?:self\s*harm|cutting\s+myself|hurting\s+myself)\b/i.test(lower)
  ) {
    if (!/\b(?:squad|pass|door|bunt|drill)\b/i.test(lower)) {
      return 'mental_health_crisis';
    }
  }

  // 2. Bereavement & Death Alert (Life-Critical Priority)
  if (
    /\b(?:ur|your|my|our|his|her|their)?\s*(?:father|mother|dad|mom|parent|brother|sister|son|daughter|grandpa|grandma|grandfather|grandmother|uncle|aunt|friend|colleague|cousin|relative|teacher|professor|student)\s+(?:has\s+)?(?:died|passed\s+away|breathed\s+(?:his|her|their)\s+last|expired|is\s+no\s+more|succumbed)\b/i.test(text) ||
    /\b(?:sad\s+demise|untimely\s+demise|passed\s+away|condolence|condolences|obituary|funeral|cremation|burial|rest\s+in\s+peace|r\.?i\.?p\.?|loss\s+of\s+our\s+beloved)\b/i.test(lower)
  ) {
    // Avoid metaphors like "dead battery", "rip my gpa"
    if (!/\b(?:battery|phone|laptop|game|wifi|bored|laughing|joke|gpa|sleep)\b/i.test(lower)) {
      return 'bereavement_crisis';
    }
  }

  // 2. Medical Emergency & Blood Need
  if (
    /\b(?:blood\s+(?:needed|required|group|donation)|units?\s+of\s+blood|o\s*[-+]ve|ab\s*[-+]ve|a\s*[-+]ve|b\s*[-+]ve)\b/i.test(lower) ||
    /\b(?:cardiac\s+arrest|heart\s+attack|stroke|icu|ventilator|ambulance|major\s+accident|critical\s+condition|life\s+support|emergency\s+surgery)\b/i.test(lower)
  ) {
    if (!/\b(?:game|joke|movie)\b/i.test(lower)) {
      return 'medical_emergency';
    }
  }

  // 3. Personal Crisis & SOS
  if (/\b(?:sos\b|help\s+me\s+please|please\s+help\s+me|stranded|trapped|being\s+followed|unsafe\s+here|threatened|assaulted|robbed)\b/i.test(lower)) {
    return 'personal_crisis';
  }

  // 4. Safety & Hazard Emergency
  if (/\b(?:fire\s+(?:alarm|breakout|broke\s+out|hazard)|building\s+on\s+fire|gas\s+leak|chemical\s+(?:spill|leak|hazard)|toxic\s+(?:leak|spill|fumes)|explosion|evacuat(?:e|ion)|immediate\s+evacuation|lockdown|active\s+threat|cyclone|flash\s+flood|earthquake)\b/i.test(lower)) {
    if (!/\b(?:drill|simulation)\b/i.test(lower)) {
      return 'safety';
    }
  }

  // 5. Legal & Disciplinary Notices
  if (/\b(?:legal\s+notice|court\s+summons|subpoena|show\s+cause\s+notice|disciplinary\s+committee|disciplinary\s+action|police\s+complaint|debarred|detained)\b/i.test(lower)) {
    return 'legal';
  }

  // 6. Internship & Placement (e.g. TCS drive, resumes, OA links)
  if (
    /\b(?:placement|recruitment|drive|interview|internship|hiring|job\s+offer|resume|cv|shortlist|oa\s+link|online\s+assessment)\b/i.test(lower) ||
    entities.some((e) => e.type === 'organization' && /(tcs|wipro|infosys|placement|cognizant|accenture|google|microsoft)/i.test(e.value))
  ) {
    return 'internship_placement';
  }

  // 7. Exams & Academic Submissions
  if (/\b(?:exam|examination|test|quiz|midterm|final\s+exam|hall\s+ticket|admit\s+card|assignment|project\s+report|homework|grade|marks|viva|thesis)\b/i.test(lower)) {
    return 'exam_assignment';
  }

  // 8. Financial & Payments
  if (
    entities.some((e) => e.type === 'amount') ||
    /\b(?:fee|fees|payment|tuition|dues|fine|penalty|refund|transaction|invoice|receipt|salary)\b/i.test(lower)
  ) {
    return 'financial';
  }

  // 9. Urgent Requests & Action Directives
  if (/\b(?:urgent|immediate|immediately|asap|critical|strictly\s+mandatory|vital|compulsory)\b/i.test(lower)) {
    return 'urgent_request';
  }

  // 10. Meetings & Calls
  if (/\b(?:meeting|zoom|teams|google\s+meet|conference\s+call|discussion|sync|standup)\b/i.test(lower)) {
    return 'meeting';
  }

  // 11. Deadlines
  if (
    dates.some((d) => d.kind === 'deadline' || d.kind === 'submission' || (d as any).isDeadline) ||
    /\b(?:deadline|last\s+date|due\s+by|submit\s+by|cut-off|portal\s+closes|before\s+\d)\b/i.test(lower)
  ) {
    return 'deadline';
  }

  // 12. Upcoming Events
  if (
    dates.some((d) => d.kind === 'event') ||
    /\b(?:workshop|webinar|seminar|fest|ceremony|orientation|holiday|commencement|celebration)\b/i.test(lower)
  ) {
    return 'upcoming_event';
  }

  // 13. Decisions
  if (/\b(?:resolved|agreed|approved|decided|final\s+decision|unanimous|confirmed\s+that)\b/i.test(lower)) {
    return 'decision';
  }

  // 14. Questions Pending (Unanswered query)
  if (/\?$/.test(text.trim()) || /\b(?:can\s+someone|could\s+anyone|does\s+anyone\s+know|please\s+clarify|is\s+there\s+any)\b/i.test(lower)) {
    return 'question_pending';
  }

  // 15. Tasks
  if (/\b(?:please\s+submit|please\s+complete|action\s+required|task|todo|assigned\s+to|action\s+item)\b/i.test(lower)) {
    return 'task';
  }

  // 16. Announcements
  if (/\b(?:announcement|circular|notice|all\s+students|attention|to\s+all\s+members|heads\s+up)\b/i.test(lower)) {
    return 'announcement';
  }

  return 'general';
}
