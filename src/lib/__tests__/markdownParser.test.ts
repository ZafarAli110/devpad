import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '../utils/markdownParser';

describe('markdownParser', () => {
  it('returns empty string for empty input', () => {
    expect(parseMarkdown('')).toBe('');
  });

  it('renders headings, bold, italic, and inline code', () => {
    const html = parseMarkdown('# Title\n## Subtitle\n**bold** and *italic* and `code`');

    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<h2>Subtitle</h2>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<code>code</code>');
  });

  it('renders blockquotes correctly after HTML escaping', () => {
    const html = parseMarkdown('> Quoted note');
    expect(html).toContain('<blockquote>Quoted note</blockquote>');
  });

  it('renders fenced code blocks, lists, and tables', () => {
    const md = [
      '- alpha',
      '- beta',
      '',
      '| ColA | ColB |',
      '| --- | --- |',
      '| 1 | 2 |',
      '',
      '```js',
      'const x = 1;',
      '```',
    ].join('\n');

    const html = parseMarkdown(md);
    expect(html).toContain('<ul><li>alpha</li><li>beta</li></ul>');
    expect(html).toContain('<table><thead><tr><th>ColA</th><th>ColB</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>');
    expect(html).toContain('<pre><code>const x = 1;</code></pre>');
  });

  it('escapes raw HTML tags to prevent XSS', () => {
    const html = parseMarkdown('<script>alert("xss")</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('allows safe https links but blocks javascript: URLs', () => {
    const safe = parseMarkdown('[Docs](https://example.com/docs)');
    expect(safe).toContain('<a href="https://example.com/docs" target="_blank" rel="noopener noreferrer">Docs</a>');

    const unsafe = parseMarkdown('[Click me](javascript:alert(1))');
    expect(unsafe).not.toContain('javascript:');
    expect(unsafe).not.toContain('<a ');
    expect(unsafe).toContain('Click me');
  });

  it('replaces supported emoji shortcodes', () => {
    const html = parseMarkdown('Shipped :rocket: :check:');
    expect(html).toContain('🚀');
    expect(html).toContain('✅');
  });
});
