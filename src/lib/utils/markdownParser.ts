/**
 * A simple markdown parser that converts markdown string to HTML.
 * Supports: Headings (#), Bold (**), Lists (- or *), and Code blocks (`).
 */
export function parseMarkdown(markdown: string): string {
  if (!markdown) return '';

  let html = markdown
    // Sanitize basic HTML tags to prevent XSS
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headings (match from start of line)
  html = html.replace(/^###### (.*$)/gim, '<h6>$1</h6>');
  html = html.replace(/^##### (.*$)/gim, '<h5>$1</h5>');
  html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold (**text**) - non-greedy
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');

  // Italic (*text* or _text_) - non-greedy
  html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
  html = html.replace(/_(.*?)_/gim, '<em>$1</em>');

  // Code blocks ```...``` (Handle language tag and optional newline)
  html = html.replace(/```[a-z]*\s*\n?([\s\S]*?)\n?```/gim, '<pre><code>$1</code></pre>');

  // Inline Code `text`
  html = html.replace(/`(.*?)`/gim, '<code>$1</code>');

  // Blockquotes (note: '>' is already escaped to '&gt;' above)
  html = html.replace(/^\s*&gt;\s?(.*)$/gim, '<blockquote>$1</blockquote>');

  // Tables (Basic implementation)
  const tableRegex = /^\|(.+)\|$\r?\n^\|([-:\s|]+)\|$\r?\n((?:^\|.+\|$\r?\n?)+)/gm;
  html = html.replace(tableRegex, (_match, header, _separator, body) => {
    const headers = header.split('|').filter((h: string) => h.trim()).map((h: string) => `<th>${h.trim()}</th>`).join('');
    const rows = body.trim().split(/\r?\n/).map((row: string) => {
      const cells = row.split('|').filter((c: string) => c.trim()).map((c: string) => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
  });

  // Emojis (Common ones)
  const emojis: Record<string, string> = {
    ':smile:': '😊', ':heart:': '❤️', ':check:': '✅', ':rocket:': '🚀', ':star:': '⭐',
    ':warning:': '⚠️', ':info:': 'ℹ️', ':fire:': '🔥', ':party:': '🎉', ':thumb:': '👍'
  };
  Object.entries(emojis).forEach(([key, val]) => {
    html = html.replace(new RegExp(key, 'g'), val);
  });

  // Unordered Lists (Support - or * or +)
  html = html.replace(/^\s*[\-\*\+]\s+(.*)$/gim, '<ul><li>$1</li></ul>');
  // Combine consecutive <ul> tags
  html = html.replace(/<\/ul>\s*<ul>/gim, '');

  // Ordered Lists (Support 1. )
  html = html.replace(/^\s*\d+\.\s+(.*)$/gim, '<ol><li>$1</li></ol>');
  // Combine consecutive <ol> tags
  html = html.replace(/<\/ol>\s*<ol>/gim, '');

  // Horizontal Rules
  html = html.replace(/^\s*(\*\*\*|\-\-\-|\_\_\_)\s*$/gim, '<hr />');

  // Links [text](url) — allow only safe protocols to prevent javascript: XSS
  html = html.replace(/\[(.*?)\]\((.*?)\)/gim, (_match, label: string, rawUrl: string) => {
    const trimmedUrl = rawUrl.trim();
    const isSafe = /^(https?:\/\/|mailto:|\/|#)/i.test(trimmedUrl);
    if (!isSafe) return label;
    return `<a href="${trimmedUrl}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  // Newlines to <p> if not in a structural tag
  const lines = html.split('\n');
  html = lines.map(line => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return '<br/>';
    // If it already starts with a recognized structural tag, leave it alone
    if (/^<(h[1-6]|ul|ol|li|blockquote|pre|hr|br)/i.test(trimmed)) return line;
    return `<p>${line}</p>`;
  }).join('\n');

  return html;
}
