import { test as base, expect } from '@playwright/test';

export const API_ROUTES = '**/api/v1/**';

export interface PageGuard {
  readonly problems: string[];
  readonly apiCalls: string[];
}

export const test = base.extend<{ guard: PageGuard }>({
  guard: [
    async ({ page, baseURL }, use) => {
      const guard: PageGuard = { problems: [], apiCalls: [] };
      const origin = new URL(baseURL ?? 'http://127.0.0.1').origin;

      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (event) => {
          console.error(`CSP violation: ${event.violatedDirective} ${event.blockedURI}`);
        });
      });
      page.on('console', (message) => {
        if (message.type() === 'error') {
          guard.problems.push(message.text());
        }
      });
      page.on('pageerror', (error) => guard.problems.push(error.message));
      page.on('request', (request) => {
        if (new URL(request.url()).origin !== origin) {
          guard.problems.push(`Third-party request: ${request.url()}`);
        }
      });
      await page.route(API_ROUTES, async (route) => {
        guard.apiCalls.push(
          `${route.request().method()} ${new URL(route.request().url()).pathname}`,
        );
        await route.abort();
      });

      await use(guard);

      expect(guard.problems, 'console errors, page errors or CSP violations').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
