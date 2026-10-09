import type { FindingCategory, ExtractedDateTime, ExtractedEntity } from '@/types';

export function categorizeMessage(
  text: string,
  dates: ExtractedDateTime[],
  entities: ExtractedEntity[]
): FindingCategory {
  const lower = text.toLowerCase();

  // 1. Safety & Emergency
  if (/\b(fire|earthquake|emergency|safety|danger|evacuate|security breach|hazard)\b/i.test(lower)) {
    return 'safety';
  }

  // 2. Internship & Placement (e.g. TCS drive, resumes)
  if (/\b(placement|recruitment|drive|interview|internship|hiring|job offer|resume|cv|shortlist)\b/i.test(lower) ||
      entities.some((e) => e.type === 'organization' && /(tcs|wipro|infosys|placement)/i.test(e.value))) {
    return 'internship_placement';
  }

  // 3. Exams & Assignments
  if (/\b(exam|examination|test|quiz|midterm|final|hall ticket|assignment|project report|homework|grade|marks)\b/i.test(lower)) {
    return 'exam_assignment';
  }

  // 4. Financial & Payments
  if (entities.some((e) => e.type === 'amount') ||
      /\b(fee|fees|payment|tuition|dues|fine|penalty|refund|transaction|invoice|receipt)\b/i.test(lower)) {
    return 'financial';
  }

  // 5. Urgent Requests
  if (/\b(urgent|immediate|immediately|asap|critical|strictly mandatory)\b/i.test(lower)) {
    return 'urgent_request';
  }

  // 6. Meetings & Calls
  if (/\b(meeting|zoom|teams|google meet|conference call|discussion|sync)\b/i.test(lower)) {
    return 'meeting';
  }

  // 7. Deadlines
  if (dates.some((d) => d.kind === 'deadline' || d.kind === 'submission' || (d as any).isDeadline) ||
      /\b(deadline|last date|due by|submit by|cut-off|before \d)\b/i.test(lower)) {
    return 'deadline';
  }

  // 8. Upcoming Events
  if (dates.some((d) => d.kind === 'event') ||
      /\b(workshop|webinar|seminar|fest|ceremony|orientation|holiday|commencement)\b/i.test(lower)) {
    return 'upcoming_event';
  }

  // 9. Decisions
  if (/\b(resolved|agreed|approved|decided|final decision|unanimous|confirmed that)\b/i.test(lower)) {
    return 'decision';
  }

  // 10. Questions pending
  if (/\?$/.test(text.trim()) || /\b(can someone|could anyone|does anyone know|please clarify|is there any)\b/i.test(lower)) {
    return 'question_pending';
  }

  // 11. Tasks
  if (/\b(please submit|please complete|action required|task|todo|assigned to)\b/i.test(lower)) {
    return 'task';
  }

  // 12. Announcements
  if (/\b(announcement|circular|notice|all students|attention|to all members|heads up)\b/i.test(lower)) {
    return 'announcement';
  }

  return 'general';
}
