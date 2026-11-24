import { DEFAULT_LANGUAGE, findLanguage, type LanguageId } from '../../../lib/languages';

export const HIGHLIGHT_CHARACTER_LIMIT = 131_072;
export const HIGHLIGHT_LINE_LIMIT = 10_000;
export const SIZE_CAP_NOTE = "Syntax highlighting is off for this paste: it's too long.";
export const LINE_CAP_NOTE =
  'Syntax highlighting is off for this paste: a line is over 10,000 characters.';
export const COPY_LABEL = 'Copy';
export const COPIED_ANNOUNCEMENT = 'Paste copied to clipboard.';
export const WRAP_LABEL = 'Wrap lines';
export const DOWNLOAD_LABEL = 'Download';
export const DOWNLOAD_MEDIA_TYPE = 'text/plain;charset=utf-8';

const WRAPPED_BY_DEFAULT: ReadonlySet<LanguageId> = new Set([DEFAULT_LANGUAGE, 'markdown']);
const LINE_BREAKS = /\r\n|\r|\n/g;

export type HighlightDecision = 'highlight' | 'plain-text' | 'over-size-cap' | 'over-line-cap';

const CAP_NOTES: Readonly<Partial<Record<HighlightDecision, string>>> = {
  'over-size-cap': SIZE_CAP_NOTE,
  'over-line-cap': LINE_CAP_NOTE,
};

export function languageLabel(language: LanguageId): string {
  return findLanguage(language)?.label ?? '';
}

export function wrapsByDefault(language: LanguageId): boolean {
  return WRAPPED_BY_DEFAULT.has(language);
}

function hasLineLongerThan(content: string, limit: number): boolean {
  let lineStart = 0;
  for (const match of content.matchAll(LINE_BREAKS)) {
    if (match.index - lineStart > limit) {
      return true;
    }
    lineStart = match.index + match[0].length;
  }
  return content.length - lineStart > limit;
}

// Some grammars (Bash, Rust) slow down quadratically on one long unbroken token, so the size cap
// alone does not bound the main-thread freeze.
export function highlightDecision(language: LanguageId, content: string): HighlightDecision {
  if (language === DEFAULT_LANGUAGE) {
    return 'plain-text';
  }
  if (content.length > HIGHLIGHT_CHARACTER_LIMIT) {
    return 'over-size-cap';
  }
  if (hasLineLongerThan(content, HIGHLIGHT_LINE_LIMIT)) {
    return 'over-line-cap';
  }
  return 'highlight';
}

export function capNote(decision: HighlightDecision): string | undefined {
  return CAP_NOTES[decision];
}

export function regionLabel(language: LanguageId, lineCountText: string): string {
  return `Paste content, ${languageLabel(language)}, ${lineCountText}`;
}
