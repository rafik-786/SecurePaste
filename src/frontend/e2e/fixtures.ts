import { test as base, expect, type Page } from '@playwright/test';

export const API_ROUTES = '**/api/v1/**';
export const THEME_STORAGE_KEY = 'securepaste.theme';
export const THEMES = ['dark', 'light'] as const;
export type Theme = (typeof THEMES)[number];

export async function applyTheme(page: Page, theme: Theme): Promise<void> {
  if (theme === 'light') {
    await page.addInitScript((key) => {
      localStorage.setItem(key, 'light');
    }, THEME_STORAGE_KEY);
  }
}

const FAILED_RESOURCE = /^Failed to load resource: the server responded with a status of (\d{3})\b/;

export interface PageGuard {
  readonly problems: string[];
  readonly apiCalls: string[];
  readonly expectHttpError: (status: number) => Promise<void>;
}

export const test = base.extend<{ guard: PageGuard }>({
  guard: [
    async ({ page, baseURL }, use) => {
      const problems: string[] = [];
      const origin = new URL(baseURL ?? 'http://127.0.0.1').origin;
      const guard: PageGuard = {
        problems,
        apiCalls: [],
        // Chrome logs every non-2xx response as a console error. A test that mocks one on purpose
        // takes exactly that line off the guard; any other console error still fails the test.
        expectHttpError: async (status) => {
          const matches = (problem: string) =>
            FAILED_RESOURCE.exec(problem)?.[1] === String(status);
          await expect
            .poll(() => problems.some(matches), { message: `a logged ${status} response` })
            .toBe(true);
          problems.splice(problems.findIndex(matches), 1);
        },
      };

      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (event) => {
          console.error(`CSP violation: ${event.violatedDirective} ${event.blockedURI}`);
        });
      });
      page.on('console', (message) => {
        if (message.type() === 'error') {
          problems.push(message.text());
        }
      });
      page.on('pageerror', (error) => problems.push(error.message));
      page.on('request', (request) => {
        if (new URL(request.url()).origin !== origin) {
          problems.push(`Third-party request: ${request.url()}`);
        }
      });
      await page.route(API_ROUTES, async (route) => {
        guard.apiCalls.push(
          `${route.request().method()} ${new URL(route.request().url()).pathname}`,
        );
        await route.abort();
      });

      await use(guard);

      expect(problems, 'console errors, page errors or CSP violations').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
