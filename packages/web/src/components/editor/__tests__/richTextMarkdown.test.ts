import { describe, expect, it } from 'vitest';
import { htmlToMarkdown, markdownToHtml, normalizeRichTextMarkdown } from '../richTextMarkdown';

describe('rich text markdown conversion', () => {
  it('normalizes newline and trailing whitespace consistently', () => {
    const input = '## Title\r\n\r\nLine one.\r\n\r\n\r\nLine two.\t\t\n\n';
    expect(normalizeRichTextMarkdown(input)).toBe('## Title\n\nLine one.\n\nLine two.');
  });

  it('serializes html to markdown with predictable rules', () => {
    const html = '<h2>Heading</h2><p>Hello <strong>world</strong> <em>today</em>.</p><p><a href="https://example.com">Read more</a></p><p><del>old</del></p>';
    const markdown = htmlToMarkdown(html);

    expect(markdown).toContain('## Heading');
    expect(markdown).toContain('Hello **world** _today_.');
    expect(markdown).toContain('[Read more](https://example.com)');
    expect(markdown).toContain('~~old~~');
  });

  it('serializes markdown to html using gfm rendering', () => {
    const markdown = '### Features\n\n- One\n- Two\n\n`inline`';
    const html = markdownToHtml(markdown);

    expect(html).toContain('<h3>Features</h3>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>One</li>');
    expect(html).toContain('<code>inline</code>');
  });
});
