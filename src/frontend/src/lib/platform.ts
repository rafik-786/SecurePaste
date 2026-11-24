const APPLE_PLATFORM_PATTERN = /Mac|iPhone|iPad|iPod/i;
const APPLE_CLIENT_HINT_PLATFORMS: ReadonlySet<string> = new Set(['macOS', 'iOS']);
const FINE_POINTER_QUERY = '(pointer: fine)';

export const SUBMIT_KEY_SHORTCUTS = 'Control+Enter Meta+Enter';

export interface PlatformHints {
  readonly userAgentData?: { readonly platform?: string } | undefined;
  readonly platform?: string;
  readonly userAgent?: string;
}

export interface CryptoHost {
  readonly isSecureContext?: boolean;
  readonly crypto?: { readonly subtle?: unknown } | undefined;
}

export interface ModifiedKey {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
}

type MediaMatcher = (query: string) => { readonly matches: boolean };

export function isApplePlatform(hints: PlatformHints = navigator): boolean {
  const clientHint = hints.userAgentData?.platform;
  if (clientHint !== undefined && clientHint !== '') {
    return APPLE_CLIENT_HINT_PLATFORMS.has(clientHint);
  }
  const legacy =
    hints.platform !== undefined && hints.platform !== '' ? hints.platform : hints.userAgent;
  return legacy !== undefined && APPLE_PLATFORM_PATTERN.test(legacy);
}

export function webCryptoAvailable(host: CryptoHost = globalThis): boolean {
  return host.isSecureContext === true && host.crypto?.subtle != null;
}

export function hasFinePointer(
  matchMedia: MediaMatcher = (query) => window.matchMedia(query),
): boolean {
  return matchMedia(FINE_POINTER_QUERY).matches;
}

export function isSubmitShortcut(event: ModifiedKey): boolean {
  return event.key === 'Enter' && (event.ctrlKey || event.metaKey);
}
