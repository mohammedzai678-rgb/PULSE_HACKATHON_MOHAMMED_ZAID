/**
 * Minimal RFC 4180 CSV parser: handles quoted fields, escaped quotes, embedded
 * commas/newlines and CRLF. Detects `;` and tab delimiters when the header suggests them.
 */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = detectDelimiter(firstLine);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

function detectDelimiter(headerLine: string): string {
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  let inQ = false;
  for (const ch of headerLine) {
    if (ch === '"') inQ = !inQ;
    else if (!inQ && ch in counts) counts[ch]++;
  }
  let best = ',';
  for (const d of [';', '\t']) if (counts[d] > counts[best]) best = d;
  return best;
}

/** Convert CSV rows to objects keyed by lower-cased, trimmed header names. */
export function csvToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''));
  return rows.slice(1).map((r) => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => {
      o[h] = (r[i] ?? '').trim();
    });
    return o;
  });
}
