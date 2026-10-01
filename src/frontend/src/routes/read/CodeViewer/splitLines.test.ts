import { describe, expect, it } from 'vitest';
import { escapeHtml, highlight } from '../../../lib/highlight';
import { splitHighlightedLines } from './splitLines';

const COMMENT = '<span class="hljs-comment">';
const STRING = '<span class="hljs-string">';
const SUBST = '<span class="hljs-subst">';
const CLOSE = '</span>';

function textOf(lineHtml: string): string {
  return lineHtml
    .replace(/<[^>]*>/g, '')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
    .replaceAll('&amp;', '&');
}

function isBalanced(lineHtml: string): boolean {
  let depth = 0;
  for (const [tag] of lineHtml.matchAll(/<\/?span\b[^>]*>/g)) {
    depth += tag.startsWith('</') ? -1 : 1;
    if (depth < 0) {
      return false;
    }
  }
  return depth === 0;
}

describe('splitHighlightedLines', () => {
  it('splits plain escaped text at every newline', () => {
    expect(splitHighlightedLines('# staging database\nexport DB_HOST=db.internal\nx')).toEqual([
      '# staging database',
      'export DB_HOST=db.internal',
      'x',
    ]);
  });

  it('closes a multi-line comment at each line end and reopens it on the next line', () => {
    const html = `a ${COMMENT}/* one\ntwo\nthree */${CLOSE} b`;

    expect(splitHighlightedLines(html)).toEqual([
      `a ${COMMENT}/* one${CLOSE}`,
      `${COMMENT}two${CLOSE}`,
      `${COMMENT}three */${CLOSE} b`,
    ]);
  });

  it('reopens nested spans in their original order', () => {
    const html = `${STRING}\`a ${SUBST}\${x\ny}${CLOSE} b\nc\`${CLOSE}`;

    expect(splitHighlightedLines(html)).toEqual([
      `${STRING}\`a ${SUBST}\${x${CLOSE}${CLOSE}`,
      `${STRING}${SUBST}y}${CLOSE} b${CLOSE}`,
      `${STRING}c\`${CLOSE}`,
    ]);
  });

  it('never splits an entity', () => {
    const html = escapeHtml('a && b < c\n"d" & \'e\' > f');

    const lines = splitHighlightedLines(html);

    expect(lines).toEqual(['a &amp;&amp; b &lt; c', '&quot;d&quot; &amp; &#x27;e&#x27; &gt; f']);
  });

  it('does not add a line for a single trailing newline', () => {
    expect(splitHighlightedLines('a\nb\n')).toEqual(['a', 'b']);
  });

  it('keeps a second trailing newline as an empty last line', () => {
    expect(splitHighlightedLines('a\n\n')).toEqual(['a', '']);
  });

  it('drops a trailing line that holds only reopened tags', () => {
    expect(splitHighlightedLines(`${COMMENT}# note\n${CLOSE}`)).toEqual([
      `${COMMENT}# note${CLOSE}`,
    ]);
  });

  it('treats \\r\\n as one break and keeps \\r out of the lines', () => {
    expect(splitHighlightedLines('a\r\nb\r\n\r\nc')).toEqual(['a', 'b', '', 'c']);
  });

  it('treats a lone \\r as a break, because the HTML parser would turn it into one', () => {
    expect(splitHighlightedLines('a\rb')).toEqual(['a', 'b']);
  });

  it('keeps empty lines in the middle', () => {
    expect(splitHighlightedLines('a\n\n\nb')).toEqual(['a', '', '', 'b']);
  });

  it('gives empty text one empty line', () => {
    expect(splitHighlightedLines('')).toEqual(['']);
  });

  it('gives a lone newline one empty line', () => {
    expect(splitHighlightedLines('\n')).toEqual(['']);
  });

  it('round-trips real highlight.js output: same text per line, balanced spans', async () => {
    const source = [
      '/* a comment',
      '   over two lines */',
      'const greeting = `hello ${name',
      '} & <goodbye>`;',
      '',
      "const quote = 'it\\'s';",
      '',
    ].join('\n');

    const lines = splitHighlightedLines(await highlight(source, 'javascript'));

    expect(lines.map(textOf)).toEqual(source.split('\n').slice(0, -1));
    expect(lines.every(isBalanced)).toBe(true);
    expect(lines[0]).toContain('hljs-comment');
    expect(lines[1]).toMatch(/^<span class="hljs-comment">/);
  });

  it('round-trips a multi-line Markdown code block with CRLF endings', async () => {
    const source = '# Title\r\n\r\n```bash\r\necho "a & b"\r\n```\r\n';

    const lines = splitHighlightedLines(await highlight(source, 'markdown'));

    expect(lines.map(textOf)).toEqual(['# Title', '', '```bash', 'echo "a & b"', '```']);
    expect(lines.every(isBalanced)).toBe(true);
  });
});
