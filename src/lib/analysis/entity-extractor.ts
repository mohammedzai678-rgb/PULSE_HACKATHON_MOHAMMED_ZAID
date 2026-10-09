import type { ExtractedEntity } from '@/types';
import { generateId } from '@/lib/utils';

export function extractEntities(text: string, messageId: string = ''): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const seenValues = new Set<string>();

  const addEntity = (type: ExtractedEntity['type'], value: string) => {
    const clean = value.trim();
    const key = `${type}:${clean.toLowerCase()}`;
    if (!clean || seenValues.has(key)) return;
    seenValues.add(key);

    entities.push({
      id: generateId(),
      type,
      value: clean,
      sourceMessageId: messageId,
    });
  };

  // 1. Phone numbers
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
  let match: RegExpExecArray | null;
  while ((match = phoneRegex.exec(text)) !== null) {
    addEntity('phone', match[0]);
  }

  // 2. Emails
  const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/gi;
  while ((match = emailRegex.exec(text)) !== null) {
    addEntity('email', match[0]);
  }

  // 3. URLs
  const urlRegex = /\bhttps?:\/\/[^\s<>"'{}|\\^`[\]]+/gi;
  while ((match = urlRegex.exec(text)) !== null) {
    addEntity('url', match[0]);
  }

  // 4. Amounts / Money
  const amountRegex = /(?:Rs\.?|₹|\$|€|£|USD|INR|EUR)\s?\d+(?:,\d{3})*(?:\.\d{2})?|\b\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:INR|USD|rupees|dollars)\b/gi;
  while ((match = amountRegex.exec(text)) !== null) {
    addEntity('amount', match[0]);
  }

  // 5. Locations (e.g. "Room 204", "Lab 2", "Auditorium", "Seminar Hall", "Main Block")
  const locationRegex = /\b(?:Room\s+\d+|Lab\s+\d+|Auditorium|Seminar\s+Hall|Main\s+Building|Conference\s+Room(?:\s+[A-Z\d]+)?|Block\s+[A-Z\d]+)\b/gi;
  while ((match = locationRegex.exec(text)) !== null) {
    addEntity('location', match[0]);
  }

  // 6. People & Titles (e.g., "Prof. Kumar", "Dr. Sharma", "Dean", "HOD", "Director")
  const personRegex = /\b(?:Prof\.|Dr\.|Mr\.|Ms\.|Mrs\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g;
  while ((match = personRegex.exec(text)) !== null) {
    addEntity('person', match[0]);
  }

  // 7. Organizations / Departments (e.g., "Placement Cell", "Dean's Office", "Examination Cell", "TCS", "Infosys")
  const orgRegex = /\b(?:Placement\s+Cell|Dean's\s+Office|Examination\s+Cell|Accounts\s+Department|Registrar\s+Office|TCS|Wipro|Infosys|Google|Microsoft)\b/gi;
  while ((match = orgRegex.exec(text)) !== null) {
    addEntity('organization', match[0]);
  }

  // 8. Reference numbers
  const refRegex = /\b(?:Ref(?:erence)?(?:\s+No\.?|\s*:|\.)?|Order\s+No\.?|Circular\s+No\.?)\s*([A-Za-z0-9\/\-_]+)\b/gi;
  while ((match = refRegex.exec(text)) !== null) {
    addEntity('reference_number', match[0]);
  }

  // 9. Mentions (@username)
  const mentionRegex = /@([a-zA-Z0-9_\.]+)/g;
  while ((match = mentionRegex.exec(text)) !== null) {
    addEntity('mention', match[0]);
  }

  return entities;
}
