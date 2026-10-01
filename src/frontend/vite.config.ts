import react from '@vitejs/plugin-react';
import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const DEFAULT_API_PROXY_TARGET = 'http://localhost:5000';
const PROXIED_PATHS = ['/api', '/healthz', '/readyz'];

const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const CSP_ANCHOR = '<link rel="icon"';

const ENTRY_CHUNK_NAME = 'index';
const ROUTE_MODULE = /[\\/]src[\\/]routes[\\/]/;
const HIGHLIGHTER_MODULE = /[\\/](highlight\.js[\\/]|src[\\/]lib[\\/]highlight\.ts)/;

// Code shared by several lazy routes would otherwise become extra common chunks, each one more
// request on first load; the budget allows HTML, theme.js, CSS, entry, one route chunk, favicon.
function belongsInEntryChunk(id: string): boolean {
  return !ROUTE_MODULE.test(id) && !HIGHLIGHTER_MODULE.test(id);
}

// Build only: the dev server injects an inline React Refresh preamble that this policy would block.
function contentSecurityPolicy(): Plugin {
  return {
    name: 'securepaste:content-security-policy',
    apply: 'build',
    transformIndexHtml(html) {
      if (!html.includes(CSP_ANCHOR)) {
        throw new Error(`index.html needs ${CSP_ANCHOR} so the policy lands before the icon.`);
      }
      const meta = `<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`;
      return html.replace(CSP_ANCHOR, `${meta}\n    ${CSP_ANCHOR}`);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, 'VITE_API_');
  const apiTarget = env.VITE_API_PROXY_TARGET ?? DEFAULT_API_PROXY_TARGET;

  return {
    plugins: [react(), contentSecurityPolicy()],
    build: {
      cssCodeSplit: false,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [{ name: ENTRY_CHUNK_NAME, test: belongsInEntryChunk }],
          },
        },
      },
    },
    server: {
      proxy: Object.fromEntries(PROXIED_PATHS.map((path) => [path, apiTarget])),
    },
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: 'unit',
            environment: 'node',
            include: ['src/lib/**/*.test.ts', 'src/api/**/*.test.ts'],
          },
        },
        {
          extends: true,
          test: {
            name: 'dom',
            environment: 'jsdom',
            include: ['src/**/*.test.{ts,tsx}'],
            exclude: ['src/lib/**', 'src/api/**'],
            setupFiles: ['./src/test/setup.ts'],
            css: { include: [/[\\/]src[\\/]styles[\\/]tokens\.css/] },
          },
        },
      ],
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/env.d.ts'],
        reporter: ['text', 'html'],
        thresholds: {
          'src/lib/**': { lines: 90 },
          'src/api/**': { lines: 90 },
        },
      },
    },
  };
});
