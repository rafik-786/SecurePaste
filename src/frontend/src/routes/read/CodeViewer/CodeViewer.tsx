import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Button } from '../../../components/Button';
import { CopyBlockedHint, CopyButton } from '../../../components/CopyButton';
import { DownloadIcon, WrapIcon } from '../../../components/icons/icons';
import { cx } from '../../../lib/classNames';
import { downloadFileName } from '../../../lib/fileName';
import { formatLineCount } from '../../../lib/format';
import { escapeHtml, highlight } from '../../../lib/highlight';
import type { LanguageId } from '../../../lib/languages';
import { NO_TRANSLATE_CLASS, NO_TRANSLATE_PROPS } from '../../../lib/leakPrevention';
import { splitHighlightedLines } from './splitLines';
import {
  capNote,
  COPIED_ANNOUNCEMENT,
  COPY_LABEL,
  DOWNLOAD_LABEL,
  DOWNLOAD_MEDIA_TYPE,
  highlightDecision,
  languageLabel,
  regionLabel,
  WRAP_LABEL,
  wrapsByDefault,
} from './viewerText';
import styles from './CodeViewer.module.css';
import syntax from './syntax.module.css';

export interface CodeViewerProps {
  readonly pasteId: string;
  readonly content: string;
  readonly language: LanguageId;
  readonly regionRef?: RefObject<HTMLPreElement | null>;
}

function saveAsFile(content: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: DOWNLOAD_MEDIA_TYPE }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function useHighlightedLines(
  content: string,
  language: LanguageId,
  enabled: boolean,
): readonly string[] | null {
  const [highlighted, setHighlighted] = useState<readonly string[] | null>(null);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    let current = true;
    void highlight(content, language).then((html) => {
      if (current) {
        setHighlighted(splitHighlightedLines(html));
      }
    });
    return () => {
      current = false;
    };
  }, [content, language, enabled]);

  return highlighted;
}

export function CodeViewer({ pasteId, content, language, regionRef }: CodeViewerProps) {
  const ownRegion = useRef<HTMLPreElement>(null);
  const region = regionRef ?? ownRegion;
  const [wrap, setWrap] = useState(() => wrapsByDefault(language));
  const [copyBlocked, setCopyBlocked] = useState(false);
  const plainLines = useMemo(() => splitHighlightedLines(escapeHtml(content)), [content]);
  const decision = useMemo(() => highlightDecision(language, content), [language, content]);
  const highlighted = useHighlightedLines(content, language, decision === 'highlight');
  const note = capNote(decision);
  const lines = highlighted?.length === plainLines.length ? highlighted : plainLines;
  const lineCount = formatLineCount(lines.length);

  return (
    <figure className={styles.viewer}>
      <div className={styles.toolbar}>
        <p className={styles.meta}>
          <span className={styles.language}>{languageLabel(language)}</span>{' '}
          <span className={styles.lineCount}>{lineCount}</span>
        </p>
        <div className={styles.actions}>
          <Button
            size="sm"
            icon={WrapIcon}
            className={cx(styles.action, styles.wrapToggle)}
            aria-pressed={wrap}
            onClick={() => {
              setWrap((current) => !current);
            }}
          >
            {WRAP_LABEL}
          </Button>
          <Button
            size="sm"
            icon={DownloadIcon}
            className={styles.action}
            onClick={() => {
              saveAsFile(content, downloadFileName(pasteId, language));
            }}
          >
            {DOWNLOAD_LABEL}
          </Button>
          <CopyButton
            variant="primary"
            size="sm"
            className={styles.action}
            text={content}
            label={COPY_LABEL}
            copiedAnnouncement={COPIED_ANNOUNCEMENT}
            selectOnFailure={region}
            onOutcome={(outcome) => {
              setCopyBlocked(outcome === 'failed');
            }}
          />
        </div>
      </div>
      {copyBlocked && <CopyBlockedHint className={styles.notice} />}
      {note !== undefined && <p className={styles.notice}>{note}</p>}
      <pre
        ref={region}
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scroll region must take focus so keyboard users can scroll it
        tabIndex={0}
        role="region"
        aria-label={regionLabel(language, lineCount)}
        {...NO_TRANSLATE_PROPS}
        className={cx(styles.region, syntax.syntax, wrap && styles.wrapped, NO_TRANSLATE_CLASS)}
        style={{ '--gutter-digits': String(lines.length).length }}
      >
        <code className={styles.lines}>
          {lines.map((lineHtml, index) => (
            <span key={index} className={styles.line}>
              <span className={styles.code} dangerouslySetInnerHTML={{ __html: lineHtml }} />
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}
