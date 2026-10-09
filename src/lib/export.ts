import type { Report } from '@/types';
import { SEVERITY_LABELS, CATEGORY_LABELS } from '@/types';
import { formatDateTime, formatDate } from '@/lib/utils';

// PDF Export using jsPDF (lazy loaded)
export async function exportReportToPdf(report: Report): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();

  let y = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - 2 * margin;

  // Helper to add text with auto page break
  function addText(text: string, fontSize: number, isBold: boolean = false) {
    doc.setFontSize(fontSize);
    if (isBold) doc.setFont('helvetica', 'bold');
    else doc.setFont('helvetica', 'normal');

    const lines = doc.splitTextToSize(text, maxWidth);
    for (const line of lines) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, margin, y);
      y += fontSize * 0.5;
    }
    y += 4;
  }

  // Title
  addText(report.title || 'Analysis Report', 20, true);
  addText(`Generated: ${formatDateTime(report.generatedAt)}`, 10);
  addText(`Sources: ${report.sources.length} | Messages: ${report.totalMessagesProcessed} | Findings: ${report.findings.length}`, 10);
  y += 6;

  // Executive Summary
  addText('Executive Summary', 14, true);
  addText(report.executiveSummary, 10);
  y += 4;

  // Findings by severity
  addText('Findings', 14, true);
  for (const finding of report.findings) {
    addText(`[${finding.severity} - ${SEVERITY_LABELS[finding.severity]}] ${finding.title}`, 11, true);
    addText(finding.description, 9);
    if (finding.requiredAction) addText(`Action: ${finding.requiredAction}`, 9);
    if (finding.deadline) addText(`Deadline: ${formatDate(finding.deadline)}`, 9);
    addText(`Source: ${finding.sourceFilename}`, 8);
    y += 2;
  }

  // Action Items
  if (report.actionItems.length > 0) {
    addText('Action Items', 14, true);
    for (const item of report.actionItems) {
      const checkbox = item.status === 'completed' ? '[x]' : '[ ]';
      addText(`${checkbox} ${item.taskDescription}`, 10);
      if (item.deadline) addText(`  Due: ${formatDate(item.deadline)}`, 9);
    }
  }

  // Timeline
  if (report.timeline.length > 0) {
    addText('Timeline', 14, true);
    for (const entry of report.timeline) {
      addText(`${formatDate(entry.date)} - ${entry.title}: ${entry.description}`, 10);
    }
  }

  // Limitations
  if (report.limitations.length > 0) {
    addText('Limitations', 14, true);
    for (const lim of report.limitations) {
      addText(`• ${lim}`, 10);
    }
  }

  doc.save(`${report.title || 'report'}.pdf`);
}

// Markdown Export
export function exportReportToMarkdown(report: Report): string {
  let md = '';

  md += `# ${report.title || 'Analysis Report'}\n\n`;
  md += `**Generated:** ${formatDateTime(report.generatedAt)}\n\n`;
  md += `**Sources analyzed:** ${report.sources.length} | **Messages:** ${report.totalMessagesProcessed} | **Findings:** ${report.findings.length}\n\n`;
  md += `---\n\n`;

  // Executive Summary
  md += `## Executive Summary\n\n${report.executiveSummary}\n\n`;

  // Severity Dashboard
  md += `## Severity Dashboard\n\n`;
  const bySeverity = { S4: 0, S3: 0, S2: 0, S1: 0, S0: 0 };
  for (const f of report.findings) {
    if (f.severity in bySeverity) bySeverity[f.severity as keyof typeof bySeverity]++;
  }
  md += `| Severity | Count |\n|---|---|\n`;
  for (const [sev, count] of Object.entries(bySeverity)) {
    md += `| ${sev} - ${SEVERITY_LABELS[sev as keyof typeof SEVERITY_LABELS]} | ${count} |\n`;
  }
  md += `\n`;

  // Findings
  md += `## Detailed Findings\n\n`;
  for (const f of report.findings) {
    md += `### ${f.severity} · ${f.title}\n\n`;
    md += `**Category:** ${CATEGORY_LABELS[f.category]}\n`;
    md += `**What it says:** ${f.description}\n`;
    md += `**Why it matters:** ${f.whyItMatters}\n`;
    md += `**Required action:** ${f.requiredAction}\n`;
    if (f.sender) md += `**Sender:** ${f.sender}\n`;
    if (f.deadline) md += `**Deadline:** ${formatDate(f.deadline)}\n`;
    if (f.consequence) md += `**Consequence:** ${f.consequence}\n`;
    md += `**Source:** ${f.sourceFilename}\n`;
    md += `**Confidence:** ${f.confidence}\n`;
    if (f.originalExcerpt && report.includeExcerpts) {
      md += `\n> ${f.originalExcerpt}\n`;
    }
    md += `\n---\n\n`;
  }

  // Action Items
  if (report.actionItems.length > 0) {
    md += `## Action Items\n\n`;
    for (const a of report.actionItems) {
      const check = a.status === 'completed' ? 'x' : ' ';
      md += `- [${check}] ${a.taskDescription}`;
      if (a.deadline) md += ` *(Due: ${formatDate(a.deadline)})*`;
      md += `\n`;
    }
    md += `\n`;
  }

  // Timeline
  if (report.timeline.length > 0) {
    md += `## Timeline\n\n`;
    for (const t of report.timeline) {
      md += `- **${formatDate(t.date)}** — ${t.title}: ${t.description}\n`;
    }
    md += `\n`;
  }

  // Limitations
  if (report.limitations.length > 0) {
    md += `## Limitations\n\n`;
    for (const l of report.limitations) {
      md += `- ${l}\n`;
    }
  }

  return md;
}

// JSON Export
export function exportReportToJson(report: Report): string {
  return JSON.stringify(report, null, 2);
}

// Download helper
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
