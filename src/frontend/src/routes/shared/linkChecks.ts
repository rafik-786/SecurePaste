const FRAGMENT_MARK = '#';

export function fragmentOf(hash: string): string {
  return hash.startsWith(FRAGMENT_MARK) ? hash.slice(FRAGMENT_MARK.length) : hash;
}
