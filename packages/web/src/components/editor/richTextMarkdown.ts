import { marked } from 'marked';
import TurndownService from 'turndown';

marked.setOptions({
  gfm: true,
  breaks: true,
});

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '_',
  strongDelimiter: '**',
});

turndown.addRule('strikethrough', {
  filter: (node) => {
    const name = node.nodeName.toLowerCase();
    return name === 'del' || name === 's' || name === 'strike';
  },
  replacement: (content) => `~~${content}~~`,
});

function normalizeMarkdown(markdown: string): string {
  return (markdown || '')
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, '  ')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
}

export function markdownToHtml(markdown: string): string {
  const rendered = marked.parse(normalizeMarkdown(markdown));
  return typeof rendered === 'string' ? rendered : '';
}

export function htmlToMarkdown(html: string): string {
  return normalizeMarkdown(turndown.turndown(html || ''));
}

export function normalizeRichTextMarkdown(markdown: string): string {
  return normalizeMarkdown(markdown);
}
