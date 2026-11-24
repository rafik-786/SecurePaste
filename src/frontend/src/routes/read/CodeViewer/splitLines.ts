const CLOSE_TAG = '</span>';
const TAG_OR_BREAK = /<span\b[^>]*>|<\/span>|\r\n|\r|\n/g;
const ANY_TAG = /<[^>]*>/g;

function hasText(lineHtml: string): boolean {
  return lineHtml.replace(ANY_TAG, '') !== '';
}

// Input is highlight output: escaped text plus <span> tags, so "<" only ever starts a tag and an
// entity never contains a line break. A lone "\r" counts as a break because the HTML parser turns
// it into "\n" when the line is injected, which would wrap a row under a single line number.
export function splitHighlightedLines(html: string): string[] {
  const lines: string[] = [];
  const open: string[] = [];
  let line = '';
  let consumed = 0;

  for (const match of html.matchAll(TAG_OR_BREAK)) {
    const token = match[0];
    line += html.slice(consumed, match.index);
    consumed = match.index + token.length;

    if (token === CLOSE_TAG) {
      open.pop();
      line += token;
    } else if (token.startsWith('<')) {
      open.push(token);
      line += token;
    } else {
      lines.push(line + CLOSE_TAG.repeat(open.length));
      line = open.join('');
    }
  }
  line += html.slice(consumed);

  if (lines.length === 0 || hasText(line)) {
    lines.push(line);
  }
  return lines;
}
