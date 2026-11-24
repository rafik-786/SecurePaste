import { describe, expect, it } from 'vitest';
import { downloadFileName } from './fileName';
import { LANGUAGES } from './languages';

const PASTE_ID = 'x7k2mn4pq9rs';

describe('downloadFileName', () => {
  it('names the file after the paste and its language', () => {
    expect(downloadFileName(PASTE_ID, 'python')).toBe('paste-x7k2mn4pq9rs.py');
  });

  it.each([
    { language: 'plaintext', expected: 'paste-x7k2mn4pq9rs.txt' },
    { language: 'csharp', expected: 'paste-x7k2mn4pq9rs.cs' },
    { language: 'xml', expected: 'paste-x7k2mn4pq9rs.html' },
    { language: 'dockerfile', expected: 'paste-x7k2mn4pq9rs.dockerfile' },
    { language: 'typescript', expected: 'paste-x7k2mn4pq9rs.ts' },
  ])('maps $language to $expected', ({ language, expected }) => {
    expect(downloadFileName(PASTE_ID, language)).toBe(expected);
  });

  it.each([{ language: 'cobol' }, { language: '' }, { language: 'constructor' }])(
    'falls back to .txt for the unknown language "$language"',
    ({ language }) => {
      expect(downloadFileName(PASTE_ID, language)).toBe('paste-x7k2mn4pq9rs.txt');
    },
  );

  it('gives every picker language a plain extension', () => {
    for (const language of LANGUAGES) {
      expect(downloadFileName(PASTE_ID, language.id)).toMatch(/^paste-x7k2mn4pq9rs\.[a-z]+$/);
    }
  });
});
