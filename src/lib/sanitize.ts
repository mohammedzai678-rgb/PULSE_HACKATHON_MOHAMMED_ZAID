/**
 * Safe HTML → text conversion for untrusted input (Telegram HTML exports,
 * HTML emails). Uses DOMParser, which builds an inert document: scripts are never
 * executed and resources are never fetched. Only `textContent` is read; the
 * resulting markup is never inserted into the live DOM.
 */
export function htmlToText(html: string): string {
  if (typeof DOMParser === 'undefined') {
    // Non-DOM environment (worker): conservative regex fallback
    return html
      .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style, iframe, object, embed, noscript, template').forEach((n) => n.remove());
  doc.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  doc.querySelectorAll('p, div, tr, li, h1, h2, h3, h4, h5, h6').forEach((el) => el.append('\n'));
  return (doc.body.textContent ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
