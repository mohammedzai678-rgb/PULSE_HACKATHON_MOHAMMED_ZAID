import { describe, it, expect } from 'vitest';
import { htmlToText } from './sanitize';

describe('Sanitization & Security Pipeline', () => {
  it('strips dangerous script and iframe tags from untrusted input', () => {
    const maliciousHtml = '<div>Important Announcement <script>alert("xss")</script><iframe src="evil.com"></iframe>Please attend.</div>';
    const cleanText = htmlToText(maliciousHtml);

    expect(cleanText).not.toContain('<script>');
    expect(cleanText).not.toContain('alert("xss")');
    expect(cleanText).not.toContain('iframe');
    expect(cleanText).toContain('Important Announcement');
    expect(cleanText).toContain('Please attend.');
  });

  it('converts HTML formatting and breaks cleanly to text lines', () => {
    const formatted = '<p>Heading</p><br/><ul><li>Item 1</li><li>Item 2</li></ul>';
    const text = htmlToText(formatted);

    expect(text).toContain('Heading');
    expect(text).toContain('Item 1');
    expect(text).toContain('Item 2');
  });
});
