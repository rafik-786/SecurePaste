import { describe, expect, it } from 'vitest';
import {
  hasFinePointer,
  isApplePlatform,
  isSubmitShortcut,
  SUBMIT_KEY_SHORTCUTS,
  webCryptoAvailable,
} from './platform';

const MAC_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)';
const WINDOWS_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

describe('isApplePlatform', () => {
  it.each([
    { name: 'macOS client hints', hints: { userAgentData: { platform: 'macOS' } }, apple: true },
    { name: 'iOS client hints', hints: { userAgentData: { platform: 'iOS' } }, apple: true },
    {
      name: 'Windows client hints',
      hints: { userAgentData: { platform: 'Windows' } },
      apple: false,
    },
    {
      name: 'client hints over a contradicting platform',
      hints: { userAgentData: { platform: 'Linux' }, platform: 'MacIntel' },
      apple: false,
    },
    { name: 'MacIntel, which iPadOS also reports', hints: { platform: 'MacIntel' }, apple: true },
    { name: 'iPhone', hints: { platform: 'iPhone' }, apple: true },
    { name: 'Win32', hints: { platform: 'Win32' }, apple: false },
    { name: 'Linux x86_64', hints: { platform: 'Linux x86_64' }, apple: false },
    {
      name: 'an empty platform with a Mac user agent',
      hints: { platform: '', userAgent: MAC_USER_AGENT },
      apple: true,
    },
    {
      name: 'empty client hints with a Windows user agent',
      hints: { userAgentData: { platform: '' }, userAgent: WINDOWS_USER_AGENT },
      apple: false,
    },
    { name: 'nothing to go on', hints: {}, apple: false },
  ])('reads $name as apple=$apple', ({ hints, apple }) => {
    expect(isApplePlatform(hints)).toBe(apple);
  });
});

describe('webCryptoAvailable', () => {
  const subtle = {};

  it('needs a secure context and SubtleCrypto', () => {
    expect(webCryptoAvailable({ isSecureContext: true, crypto: { subtle } })).toBe(true);
  });

  it.each([
    { name: 'plain HTTP', host: { isSecureContext: false, crypto: { subtle } } },
    { name: 'no subtle', host: { isSecureContext: true, crypto: {} } },
    { name: 'no crypto', host: { isSecureContext: true } },
    { name: 'an unknown context', host: { crypto: { subtle } } },
  ])('refuses $name', ({ host }) => {
    expect(webCryptoAvailable(host)).toBe(false);
  });
});

describe('hasFinePointer', () => {
  it('asks for a fine pointer', () => {
    const queries: string[] = [];
    const matches = hasFinePointer((query) => {
      queries.push(query);
      return { matches: true };
    });

    expect(matches).toBe(true);
    expect(queries).toEqual(['(pointer: fine)']);
  });
});

describe('isSubmitShortcut', () => {
  it.each([
    { name: 'Ctrl+Enter', event: { key: 'Enter', ctrlKey: true, metaKey: false }, submits: true },
    { name: 'Cmd+Enter', event: { key: 'Enter', ctrlKey: false, metaKey: true }, submits: true },
    { name: 'Enter', event: { key: 'Enter', ctrlKey: false, metaKey: false }, submits: false },
    { name: 'Ctrl+S', event: { key: 's', ctrlKey: true, metaKey: false }, submits: false },
  ])('treats $name as submit=$submits', ({ event, submits }) => {
    expect(isSubmitShortcut(event)).toBe(submits);
  });

  it('declares both modifiers for assistive technology', () => {
    expect(SUBMIT_KEY_SHORTCUTS).toBe('Control+Enter Meta+Enter');
  });
});
