const states = new Map<string, boolean>();
const lists = new Map<string, FakeMediaQueryList>();

class FakeMediaQueryList extends EventTarget {
  readonly media: string;
  onchange: ((event: Event) => void) | null = null;

  constructor(media: string) {
    super();
    this.media = media;
  }

  get matches(): boolean {
    return states.get(this.media) ?? false;
  }

  addListener(listener: (event: Event) => void): void {
    this.addEventListener('change', listener);
  }

  removeListener(listener: (event: Event) => void): void {
    this.removeEventListener('change', listener);
  }
}

function listFor(query: string): FakeMediaQueryList {
  let list = lists.get(query);
  if (!list) {
    list = new FakeMediaQueryList(query);
    lists.set(query, list);
  }
  return list;
}

export function installMatchMedia(target: Window = window): void {
  Object.defineProperty(target, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => listFor(query),
  });
}

export function setMediaQuery(query: string, matches: boolean): void {
  states.set(query, matches);
  const list = lists.get(query);
  if (list) {
    const event = Object.assign(new Event('change'), { matches, media: query });
    list.onchange?.(event);
    list.dispatchEvent(event);
  }
}

export function resetMediaQueries(): void {
  states.clear();
  lists.clear();
}

export const DARK_SCHEME = '(prefers-color-scheme: dark)';
export const COARSE_POINTER = '(pointer: coarse)';
export const FINE_POINTER = '(pointer: fine)';
