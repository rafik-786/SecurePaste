import { vi } from 'vitest';

// jsdom leaves isSecureContext undefined, which the app reads as "no Web Crypto". The setup file
// unstubs every global after each test.
export function stubSecureContext(secure = true): void {
  vi.stubGlobal('isSecureContext', secure);
}
