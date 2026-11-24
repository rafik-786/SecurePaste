import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { highlight } from '../../../lib/highlight';
import type { LanguageId } from '../../../lib/languages';
import { FINE_POINTER, setMediaQuery } from '../../../test/media';
import { liveRegion, renderWithProviders } from '../../../test/render';
import { CodeViewer } from './CodeViewer';

vi.mock('../../../lib/highlight', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/highlight')>();
  return { ...actual, highlight: vi.fn(actual.highlight) };
});

const ID = 'x7k2mn4pq9rs';
const SIZE_NOTE = "Syntax highlighting is off for this paste: it's too long.";
const LINE_NOTE = 'Syntax highlighting is off for this paste: a line is over 10,000 characters.';
const BASH = '# staging database\nexport DB_HOST=db.internal\nexport DB_PASSWORD=hunter2\n';
const OBJECT_URL = 'blob:http://localhost:3000/a1b2';
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

function renderViewer(content: string, language: LanguageId = 'bash') {
  return renderWithProviders(<CodeViewer pasteId={ID} content={content} language={language} />);
}

function region(): HTMLElement {
  return screen.getByRole('region', { name: /^Paste content/ });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(highlight).mockClear();
});

describe('CodeViewer toolbar and region', () => {
  it('names the language and the line count, and labels the region with both', () => {
    renderViewer(BASH);

    expect(screen.getByText('Bash')).toBeInTheDocument();
    expect(screen.getByText('3 lines')).toBeInTheDocument();
    const code = region();
    expect(code).toHaveAccessibleName('Paste content, Bash, 3 lines');
    expect(code.tagName).toBe('PRE');
    expect(code).toHaveAttribute('tabindex', '0');
    expect(code).toHaveAttribute('translate', 'no');
    expect(code).toHaveClass('notranslate');
    expect(screen.getByRole('button', { name: 'Wrap lines' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });

  it('says "1 line" for a single line', () => {
    renderViewer('only line', 'plaintext');

    expect(region()).toHaveAccessibleName('Paste content, Plain text, 1 line');
  });

  it.each([
    { content: 'a\nb\n', lines: '2 lines' },
    { content: 'a\nb\n\n', lines: '3 lines' },
    { content: 'a\r\nb\r\n', lines: '2 lines' },
    { content: 'a\n\n\nb', lines: '4 lines' },
  ])('counts $lines in $content', ({ content, lines }) => {
    renderViewer(content, 'plaintext');

    expect(region()).toHaveAccessibleName(`Paste content, Plain text, ${lines}`);
  });

  it('keeps line numbers out of the text and sets the gutter to the digits of the last line', () => {
    const content = Array.from({ length: 120 }, (_, index) => `line ${index}`).join('\n');
    renderViewer(content, 'plaintext');

    const code = region();
    expect(code.style.getPropertyValue('--gutter-digits')).toBe('3');
    expect(code.textContent).toBe(content.replaceAll('\n', ''));
  });

  it('uses one gutter digit for a short paste', () => {
    renderViewer(BASH);

    expect(region().style.getPropertyValue('--gutter-digits')).toBe('1');
  });

  it('renders markup in the paste as text', () => {
    renderViewer('<img src=x onerror=alert(1)><b>bold</b>', 'plaintext');

    expect(region().querySelector('img, b')).toBeNull();
    expect(region()).toHaveTextContent('<img src=x onerror=alert(1)><b>bold</b>');
  });
});

describe('CodeViewer wrapping', () => {
  it.each([
    { language: 'plaintext' as const, pressed: 'true' },
    { language: 'markdown' as const, pressed: 'true' },
    { language: 'bash' as const, pressed: 'false' },
    { language: 'json' as const, pressed: 'false' },
  ])('starts with wrap pressed=$pressed for $language', ({ language, pressed }) => {
    renderViewer('x', language);

    expect(screen.getByRole('button', { name: 'Wrap lines' })).toHaveAttribute(
      'aria-pressed',
      pressed,
    );
  });

  it('toggles wrapping and keeps focus on the toggle', async () => {
    const user = userEvent.setup();
    renderViewer(BASH);
    const toggle = screen.getByRole('button', { name: 'Wrap lines' });

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveFocus();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('CodeViewer download', () => {
  it('saves the exact content as UTF-8 text without a BOM and revokes the URL after the click', async () => {
    const user = userEvent.setup();
    const content = 'naïve café 🔐\r\nline two\n';
    const created: Blob[] = [];
    const order: string[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      if (blob instanceof Blob) {
        created.push(blob);
      }
      order.push('create');
      return OBJECT_URL;
    });
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {
      order.push('revoke');
    });
    const clicks: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push(this);
      order.push('click');
    });
    renderViewer(content);

    await user.click(screen.getByRole('button', { name: 'Download' }));

    expect(order).toEqual(['create', 'click', 'revoke']);
    expect(created).toHaveLength(1);
    const [blob] = created;
    expect(blob?.type).toBe('text/plain;charset=utf-8');
    const bytes = new Uint8Array((await blob?.arrayBuffer()) ?? new ArrayBuffer(0));
    expect(Array.from(bytes.slice(0, 3))).not.toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes)).toBe(content);
    expect(clicks[0]?.download).toBe('paste-x7k2mn4pq9rs.sh');
    expect(clicks[0]?.href).toBe(OBJECT_URL);
    expect(revoke).toHaveBeenCalledWith(OBJECT_URL);
  });

  it('falls back to .txt for plain text', async () => {
    const user = userEvent.setup();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue(OBJECT_URL);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });
    renderViewer('text', 'plaintext');

    await user.click(screen.getByRole('button', { name: 'Download' }));

    expect(names).toEqual(['paste-x7k2mn4pq9rs.txt']);
  });
});

describe('CodeViewer copy', () => {
  it('copies the exact original content and announces it', async () => {
    const user = userEvent.setup();
    const content = '\tindented\r\ntrailing spaces   \n';
    renderViewer(content);

    await user.click(screen.getByRole('button', { name: 'Copy' }));

    await expect(navigator.clipboard.readText()).resolves.toBe(content);
    expect(screen.getByRole('button', { name: 'Copied' })).toHaveFocus();
    expect(await screen.findByText('Paste copied to clipboard.')).toBe(liveRegion());
  });

  it('selects the code and explains the shortcut when copying is blocked', async () => {
    setMediaQuery(FINE_POINTER, true);
    const user = userEvent.setup();
    renderViewer(BASH);
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('blocked'));

    await user.click(screen.getByRole('button', { name: 'Copy' }));

    expect(
      await screen.findByText('Copying was blocked. Press Ctrl+C.', { selector: 'p' }),
    ).toBeInTheDocument();
    expect(window.getSelection()?.toString()).toContain('export DB_PASSWORD=hunter2');
    expect(screen.getByRole('button', { name: 'Copy failed' })).toBeInTheDocument();
  });
});

describe('CodeViewer highlighting', () => {
  it('highlights the whole text once and keeps a multi-line comment colored on every line', async () => {
    const content = '/* first\n   second */\nconst x = 1;\n';
    renderViewer(content, 'javascript');

    await waitFor(() => {
      expect(region().querySelectorAll('.hljs-comment')).toHaveLength(2);
    });
    expect(highlight).toHaveBeenCalledTimes(1);
    expect(highlight).toHaveBeenCalledWith(content, 'javascript');
    expect(region()).toHaveAccessibleName('Paste content, JavaScript, 3 lines');
    expect(region().querySelector('.hljs-keyword')).toHaveTextContent('const');
  });

  it('never passes plain text to the highlighter', async () => {
    renderViewer('const x = 1; // looks like code', 'plaintext');

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(highlight).not.toHaveBeenCalled();
    expect(region().querySelector('[class^="hljs-"]')).toBeNull();
  });

  it('skips highlighting over 131,072 characters and says so', async () => {
    const content = `${'x'.repeat(1_000)}\n`.repeat(131);
    renderViewer(content, 'bash');

    expect(screen.getByText(SIZE_NOTE)).toBeInTheDocument();
    expect(screen.queryByText(LINE_NOTE)).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(highlight).not.toHaveBeenCalled();
  });

  it('still highlights exactly 131,072 characters', async () => {
    renderViewer(`${'x'.repeat(1_023)}\n`.repeat(128), 'yaml');

    expect(screen.queryByText(SIZE_NOTE)).toBeNull();
    await waitFor(() => {
      expect(highlight).toHaveBeenCalledTimes(1);
    });
  });

  it('renders a 32,000-character single-line Bash paste without calling the highlighter', async () => {
    const content = 'QUJD'.repeat(8_000);
    renderViewer(content, 'bash');

    expect(content).toHaveLength(32_000);
    expect(screen.getByText(LINE_NOTE)).toBeInTheDocument();
    expect(region()).toHaveAccessibleName('Paste content, Bash, 1 line');
    expect(region()).toHaveTextContent(content);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(highlight).not.toHaveBeenCalled();
    expect(region().querySelector('[class^="hljs-"]')).toBeNull();
  });

  it('puts the long-line note where the size note goes, above the code', () => {
    renderViewer(`echo ${'a'.repeat(10_000)}\necho done\n`, 'bash');

    const note = screen.getByText(LINE_NOTE);
    expect(note.tagName).toBe('P');
    expect(note.compareDocumentPosition(region()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows only the size note when both caps apply', () => {
    renderViewer('x'.repeat(131_073), 'rust');

    expect(screen.getByText(SIZE_NOTE)).toBeInTheDocument();
    expect(screen.queryByText(LINE_NOTE)).toBeNull();
  });

  it('shows no cap note for long plain text', () => {
    renderViewer('x'.repeat(131_073), 'plaintext');

    expect(screen.queryByText(SIZE_NOTE)).toBeNull();
    expect(screen.queryByText(LINE_NOTE)).toBeNull();
  });
});

describe('CodeViewer when highlighting changes the line breaks', () => {
  async function highlighted(): Promise<string> {
    let html: unknown;
    await act(async () => {
      html = await vi.mocked(highlight).mock.results[0]?.value;
    });
    return typeof html === 'string' ? html : '';
  }

  it.each([
    { name: 'CR LF in a CSS attribute selector', content: '[x\r\ny', language: 'css', lines: 2 },
    {
      name: 'U+2028 in a CSS attribute selector',
      content: `[a${LINE_SEPARATOR}b`,
      language: 'css',
      lines: 1,
    },
    {
      name: 'U+2029 in CSS inside an XML style element',
      content: `<style>[a${PARAGRAPH_SEPARATOR}b</style>`,
      language: 'xml',
      lines: 1,
    },
  ] as const)('keeps the paste line count for $name', async ({ content, language, lines }) => {
    renderViewer(content, language);

    const html = await highlighted();

    expect(html.split('\n')).toHaveLength(lines + 1);
    expect(region()).toHaveAccessibleName(new RegExp(`, ${String(lines)} lines?$`));
    expect(region().querySelectorAll('code > span')).toHaveLength(lines);
    expect(region().querySelector('[class^="hljs-"]')).toBeNull();
    expect(region().textContent).toBe(content.replace(/\r\n|\r|\n/g, ''));
  });
});

describe('CodeViewer when its content or language changes', () => {
  const FIRST = 'const first = 1;';
  const SECOND = 'let second = 2;';

  function holdNextHighlight() {
    vi.mocked(highlight).mockImplementationOnce(() => new Promise<string>(() => undefined));
  }

  it('drops the previous highlighting until the new content is highlighted', async () => {
    const { rerender } = renderViewer(FIRST, 'javascript');
    await waitFor(() => {
      expect(region().querySelector('.hljs-keyword')).toHaveTextContent('const');
    });

    holdNextHighlight();
    rerender(<CodeViewer pasteId={ID} content={SECOND} language="javascript" />);

    expect(region()).toHaveTextContent(SECOND);
    expect(region()).not.toHaveTextContent(FIRST);
    expect(region().querySelector('[class^="hljs-"]')).toBeNull();
  });

  it('drops the previous highlighting when only the language changes', async () => {
    const { rerender } = renderViewer(FIRST, 'javascript');
    await waitFor(() => {
      expect(region().querySelector('.hljs-keyword')).toHaveTextContent('const');
    });

    holdNextHighlight();
    rerender(<CodeViewer pasteId={ID} content={FIRST} language="typescript" />);

    expect(region()).toHaveAccessibleName('Paste content, TypeScript, 1 line');
    expect(region().querySelector('[class^="hljs-"]')).toBeNull();
  });
});
