import { describe, it, expect } from 'vitest';
import { analyzeMessages } from './engine';
import { classifySeverity } from './severity-classifier';
import { categorizeMessage } from './categorizer';

describe('Urgency & Crisis Classification Engine', () => {
  it('correctly classifies "ur father has died" as S4 Critical bereavement', async () => {
    const text = 'ur father has died';
    const result = await analyzeMessages([text]);

    expect(result.findings.length).toBeGreaterThan(0);
    const finding = result.findings[0];
    expect(finding.severity).toBe('S4');
    expect(finding.category).toBe('bereavement_crisis');
    expect(finding.title).toContain('Father');
    expect(finding.whyItMatters).toContain('Critical personal/family life event');

    // Ensure action item was generated
    expect(result.actionItems.length).toBeGreaterThan(0);
    const action = result.actionItems[0];
    expect(action.severity).toBe('S4');
    expect(action.taskDescription).toContain('Contact family');
  });

  it('correctly classifies medical emergency blood requests as S4 Critical', async () => {
    const text = 'URGENT: O+ blood needed immediately at City Care ICU for surgery!';
    const result = await analyzeMessages([text]);

    const finding = result.findings[0];
    expect(finding.severity).toBe('S4');
    expect(finding.category).toBe('medical_emergency');
    expect(finding.title).toContain('Blood');
  });

  it('correctly identifies stated consequences with deadlines as S4 Critical', async () => {
    const text = 'Submit the final project report by tomorrow or your hall ticket will be withheld.';
    const result = await analyzeMessages([text]);

    const finding = result.findings[0];
    expect(finding.severity).toBe('S4');
    expect(finding.reasoning.some((r) => r.includes('consequence') || r.includes('Consequence'))).toBe(true);
  });

  it('avoids false positives from idiomatic metaphors', () => {
    const deadBattery = classifySeverity('My phone has a dead battery, will charge later', [], []);
    expect(deadBattery.severity).not.toBe('S4');

    const fireSong = categorizeMessage('This new song is fire bro', [], []);
    expect(fireSong).not.toBe('safety');

    const ripSleep = classifySeverity('RIP sleep tonight studying for test', [], []);
    expect(ripSleep.severity).not.toBe('S4');

    const mockDrill = classifySeverity('Annual mock fire drill scheduled for tomorrow at 10am', [], []);
    expect(mockDrill.severity).not.toBe('S4');

    const killingIt = classifySeverity('You are killing it on stage!', [], []);
    expect(killingIt.severity).not.toBe('S4');
  });

  it('correctly classifies fire evacuation safety alert as S4 Critical', async () => {
    const text = 'EMERGENCY: Fire broke out in the lab! Everyone evacuate the building immediately!';
    const result = await analyzeMessages([text]);

    const finding = result.findings[0];
    expect(finding.severity).toBe('S4');
    expect(finding.category).toBe('safety');
    expect(finding.title).toContain('Fire Safety');
  });

  it('correctly classifies personal SOS signal as S4 Critical personal_crisis', async () => {
    const text = 'SOS please help me I am stranded and unsafe near the highway';
    const result = await analyzeMessages([text]);

    const finding = result.findings[0];
    expect(finding.severity).toBe('S4');
    expect(finding.category).toBe('personal_crisis');
  });

  it('correctly classifies disciplinary and legal notice as legal category', async () => {
    const text = 'Official show cause notice issued by the disciplinary committee regarding conduct violation.';
    const result = await analyzeMessages([text]);

    const finding = result.findings[0];
    expect(finding.category).toBe('legal');
  });

  it('correctly classifies recruitment drive as internship_placement S3', async () => {
    const text = 'TCS campus recruitment drive registration closes on 15th October 2026. Apply on the portal.';
    const result = await analyzeMessages([text]);

    const finding = result.findings[0];
    expect(finding.category).toBe('internship_placement');
    expect(finding.severity).toBe('S3');
  });

  it('ranks trivial chit-chat as S0 Informational', () => {
    const chitChat = classifySeverity('Hey what are you having for lunch today?', [], []);
    expect(chitChat.severity).toBe('S0');
  });
});
