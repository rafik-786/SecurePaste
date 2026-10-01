import { describe, expect, it } from 'vitest';
import { DEFAULT_LANGUAGE, findLanguage, isKnownLanguage, LANGUAGES } from './languages';

describe('LANGUAGES', () => {
  it('lists plain text first, as the default', () => {
    expect(LANGUAGES[0]).toEqual({ id: 'plaintext', label: 'Plain text', extension: 'txt' });
    expect(DEFAULT_LANGUAGE).toBe('plaintext');
  });

  it('offers the 23 picker languages with unique ids and labels', () => {
    const ids = LANGUAGES.map((language) => language.id);
    const labels = LANGUAGES.map((language) => language.label);

    expect(ids).toHaveLength(23);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('labels the xml grammar for both HTML and XML', () => {
    expect(findLanguage('xml')?.label).toBe('HTML / XML');
  });
});

describe('isKnownLanguage', () => {
  it('accepts every listed id', () => {
    for (const language of LANGUAGES) {
      expect(isKnownLanguage(language.id)).toBe(true);
    }
  });

  it.each(['cobol', '', 'Python', 'html', 'constructor', '__proto__'])('rejects "%s"', (id) => {
    expect(isKnownLanguage(id)).toBe(false);
  });
});
