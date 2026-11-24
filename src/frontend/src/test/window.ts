import { vi } from 'vitest';

export const scrollToMock = vi.fn<(x: number, y: number) => void>();

export function installWindowStubs(target: Window = window): void {
  Object.defineProperty(target, 'scrollTo', {
    configurable: true,
    writable: true,
    value: scrollToMock,
  });
}
