import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';
import { emptyLedger, LEDGER_FILE_PREFIX, record, type ApiCall, type ApiLedger } from './ledger';

const FAILED_RESOURCE = /^Failed to load resource: the server responded with a status of (\d{3})\b/;

export interface Visitor {
  readonly page: Page;
  readonly context: BrowserContext;
  readonly apiCalls: ApiCall[];
  readonly count: (method: string, path: string) => number;
  readonly expectHttpError: (status: number) => Promise<void>;
}

export interface VisitOptions {
  readonly clipboard?: boolean;
}

export type Visit = (options?: VisitOptions) => Promise<Visitor>;

export const test = base.extend<{ visit: Visit }, { ledger: ApiLedger }>({
  ledger: [
    // eslint-disable-next-line no-empty-pattern -- Playwright reads a fixture's dependencies from this pattern.
    async ({}, use, workerInfo) => {
      const ledger = emptyLedger();
      await use(ledger);
      const { outputDir } = workerInfo.project;
      await mkdir(outputDir, { recursive: true });
      await writeFile(
        path.join(outputDir, `${LEDGER_FILE_PREFIX}${workerInfo.workerIndex}.json`),
        JSON.stringify(ledger),
      );
    },
    { scope: 'worker' },
  ],
  visit: async ({ browser, baseURL, ledger }, use) => {
    const origin = new URL(baseURL ?? 'http://127.0.0.1').origin;
    const opened: { readonly context: BrowserContext; readonly problems: string[] }[] = [];

    await use(async ({ clipboard = false } = {}) => {
      const context = await browser.newContext({
        ...(baseURL === undefined ? {} : { baseURL }),
        locale: 'en-US',
        timezoneId: 'UTC',
        ...(clipboard ? { permissions: ['clipboard-read', 'clipboard-write'] } : {}),
      });
      const page = await context.newPage();
      const problems: string[] = [];
      const apiCalls: ApiCall[] = [];
      opened.push({ context, problems });

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
        const url = new URL(request.url());
        if (url.origin !== origin) {
          problems.push(`Third-party request: ${request.url()}`);
          return;
        }
        if (url.pathname.startsWith('/api/')) {
          const call = { method: request.method(), path: url.pathname };
          apiCalls.push(call);
          record(ledger, call);
        }
      });

      return {
        page,
        context,
        apiCalls,
        count: (method, apiPath) =>
          apiCalls.filter((call) => call.method === method && call.path === apiPath).length,
        // Chrome logs every non-2xx response as a console error; a test takes exactly one such
        // line off the guard for each failure it expects from the real API.
        expectHttpError: async (status) => {
          const matches = (problem: string) =>
            FAILED_RESOURCE.exec(problem)?.[1] === String(status);
          await expect
            .poll(() => problems.some(matches), { message: `a logged ${status} response` })
            .toBe(true);
          problems.splice(problems.findIndex(matches), 1);
        },
      };
    });

    await Promise.all(opened.map(({ context }) => context.close()));
    expect(
      opened.flatMap(({ problems }) => problems),
      'console errors, page errors or CSP violations',
    ).toEqual([]);
  },
});

export { expect };
