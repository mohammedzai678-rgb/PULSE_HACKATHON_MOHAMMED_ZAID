/**
 * Privacy & Security: Local-first PII and Sensitive Data Redaction Engine.
 * Ensures zero credential leakage and automatic redaction of confidential data.
 */

export function redactSensitiveText(text: string): { redactedText: string; redactionCount: number } {
  let redactionCount = 0;
  let result = text;

  // 1. One-Time Passwords (OTP) and verification codes
  result = result.replace(/\b(?:otp|one[- ]time[- ]password|verification\s+code|login\s+code|auth\s+code)\s*(?:is|:|=)?\s*([0-9]{4,8})\b/gi, (match, code) => {
    redactionCount++;
    return match.replace(code, '•••••• [OTP REDACTED]');
  });

  // 2. Credit Card / Debit Card Numbers (13 to 19 digits with separators)
  result = result.replace(/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, () => {
    redactionCount++;
    return '•••• •••• •••• •••• [CARD REDACTED]';
  });

  // 3. CVV / CVC Security Codes
  result = result.replace(/\b(?:cvv|cvc|security\s+code)\s*(?:is|:|=)?\s*([0-9]{3,4})\b/gi, (match, cvv) => {
    redactionCount++;
    return match.replace(cvv, '••• [CVV REDACTED]');
  });

  // 4. Passwords, Tokens and API Keys
  result = result.replace(/\b(?:password|passwd|pwd|passcode|secret\s*key|api[_-]?key|token|bearer)\s*[:=]\s*([a-zA-Z0-9_\-.~!@#$%^&*()]{4,})/gi, (match, secret) => {
    redactionCount++;
    return match.replace(secret, '•••••••• [CREDENTIAL REDACTED]');
  });

  // 5. Government IDs: US SSN (XXX-XX-XXXX) or Indian Aadhaar (XXXX XXXX XXXX)
  result = result.replace(/\b\d{3}-\d{2}-\d{4}\b/g, () => {
    redactionCount++;
    return '•••-••-•••• [SSN REDACTED]';
  });
  result = result.replace(/\b\d{4}\s\d{4}\s\d{4}\b/g, () => {
    redactionCount++;
    return '•••• •••• •••• [AADHAAR REDACTED]';
  });

  return { redactedText: result, redactionCount };
}
