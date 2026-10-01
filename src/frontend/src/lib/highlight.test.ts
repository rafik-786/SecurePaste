import hljs from 'highlight.js/lib/core';
import { describe, expect, it, vi } from 'vitest';
import { escapeHtml, highlight } from './highlight';
import { LANGUAGES } from './languages';

const IMG_INJECTION = '<img src=x onerror=alert(1)>';
const ESCAPED_IMG_INJECTION = '&lt;img src=x onerror=alert(1)&gt;';
const ANY_TAG_BUT_SPAN = /<(?!\/?span[\s>])/;

function visibleText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
    .replaceAll('&amp;', '&');
}

describe('escapeHtml', () => {
  it('escapes a script tag', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
  });

  it('escapes ampersands before anything else can be read as an entity', () => {
    expect(escapeHtml('&lt; & &amp;')).toBe('&amp;lt; &amp; &amp;amp;');
  });

  it('escapes both quote styles so output is safe inside attributes', () => {
    expect(escapeHtml(`"double" 'single'`)).toBe('&quot;double&quot; &#x27;single&#x27;');
  });

  it('leaves ordinary text alone', () => {
    expect(escapeHtml('const x = 1; // ok 🔐')).toBe('const x = 1; // ok 🔐');
  });
});

describe('highlight', () => {
  it('registers a grammar only when it is first needed', async () => {
    expect(hljs.listLanguages()).not.toContain('go');

    await highlight('package main', 'go');

    expect(hljs.listLanguages()).toContain('go');
    expect(hljs.listLanguages()).not.toContain('kotlin');
  });

  it('registers a grammar once when calls overlap', async () => {
    const register = vi.spyOn(hljs, 'registerLanguage');

    await Promise.all([highlight('fn a() {}', 'rust'), highlight('fn b() {}', 'rust')]);

    expect(register.mock.calls.filter(([name]) => name === 'rust')).toHaveLength(1);
    register.mockRestore();
  });

  it('marks up keywords for a known language', async () => {
    await expect(highlight('def f(): pass', 'python')).resolves.toContain(
      '<span class="hljs-keyword">def</span>',
    );
  });

  it.each(LANGUAGES.map((language) => language.id))(
    'highlights %s without changing the visible text',
    async (id) => {
      const code = 'x = "<b>&</b>"; // it\'s 1 < 2\nif (a) { return b; }';

      const html = await highlight(code, id);

      expect(html).not.toMatch(ANY_TAG_BUT_SPAN);
      expect(visibleText(html)).toBe(code);
    },
  );

  it.each(['plaintext', 'cobol', '', 'constructor'])(
    'returns escaped text for the unhighlighted language "%s"',
    async (language) => {
      await expect(highlight('<b>"a" & \'b\'</b>', language)).resolves.toBe(
        '&lt;b&gt;&quot;a&quot; &amp; &#x27;b&#x27;&lt;/b&gt;',
      );
    },
  );

  it.each(['xml', 'markdown', 'python', 'javascript', 'plaintext', 'cobol'])(
    'never lets an injected img tag through for %s',
    async (language) => {
      const html = await highlight(IMG_INJECTION, language);

      expect(html).not.toContain('<img');
      expect(html).not.toMatch(ANY_TAG_BUT_SPAN);
      expect(visibleText(html)).toBe(IMG_INJECTION);
    },
  );

  it('escapes a plain-text injection exactly', async () => {
    await expect(highlight(IMG_INJECTION, 'plaintext')).resolves.toBe(ESCAPED_IMG_INJECTION);
  });
});
