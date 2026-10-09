import { describe, it, expect } from 'vitest';
import { redactSensitiveText } from './redactor';

describe('Privacy Shield & PII Redactor', () => {
  it('redacts OTP verification codes', () => {
    const text = 'Your one-time login OTP is 839201 for bank login.';
    const { redactedText, redactionCount } = redactSensitiveText(text);

    expect(redactionCount).toBeGreaterThan(0);
    expect(redactedText).not.toContain('839201');
    expect(redactedText).toContain('[OTP REDACTED]');
  });

  it('redacts credit card numbers', () => {
    const text = 'Card charged: 4111 2222 3333 4444 for registration fee.';
    const { redactedText, redactionCount } = redactSensitiveText(text);

    expect(redactionCount).toBeGreaterThan(0);
    expect(redactedText).not.toContain('4111 2222 3333 4444');
    expect(redactedText).toContain('[CARD REDACTED]');
  });

  it('redacts passwords and secret API tokens', () => {
    const text = 'Database credentials: password=supersecretpass and api_key=sk-1234567890abcdef';
    const { redactedText, redactionCount } = redactSensitiveText(text);

    expect(redactionCount).toBeGreaterThanOrEqual(2);
    expect(redactedText).not.toContain('supersecretpass');
    expect(redactedText).not.toContain('sk-1234567890abcdef');
    expect(redactedText).toContain('[CREDENTIAL REDACTED]');
  });

  it('leaves normal non-sensitive communications unmodified', () => {
    const text = 'The presentation will take place in the seminar hall tomorrow at 10 AM.';
    const { redactedText, redactionCount } = redactSensitiveText(text);

    expect(redactionCount).toBe(0);
    expect(redactedText).toBe(text);
  });
});
