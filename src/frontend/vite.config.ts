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
  "font-src 'self'",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const CSP_ANCHOR = '<link rel="icon"';
const PRELOAD_ANCHOR = '<script src="/theme.js"></script>';
const PRELOADED_FONTS = ['ibm-plex-sans-latin-wght-normal', 'jetbrains-mono-latin-wght-normal'];

const ENTRY_CHUNK_NAME = 'index';
const ROUTE_MODULE = /[\\/]src[\\/]routes[\\/](?!shared[\\/])/;
const HIGHLIGHTER_MODULE = /[\\/](highlight\.js[\\/]|src[\\/]lib[\\/]highlight\.ts)/;

// Code shared by several lazy routes would otherwise become extra common chunks, each one more
// request on first load. The budget allows nine: HTML, theme.js, entry, rolldown runtime, CSS,
// one route chunk, favicon and the two preloaded fonts. The runtime chunk exists because
// highlight.js core is CommonJS, and the entry group cannot absorb it.
function belongsInEntryChunk(id: string): boolean {
  return !ROUTE_MODULE.test(id) && !HIGHLIGHTER_MODULE.test(id);
}

function requireAnchor(html: string, anchor: string, reason: string): void {
  if (!html.includes(anchor)) {
    throw new Error(`index.html needs ${anchor} ${reason}.`);
  }
}

function fontPreloads(fileNames: readonly string[], base: string): string[] {
  return PRELOADED_FONTS.map((face) => {
    const matches = fileNames.filter((fileName) => {
      const name = fileName.slice(fileName.lastIndexOf('/') + 1);
      return name.startsWith(`${face}-`) && name.endsWith('.woff2');
    });
    if (matches.length !== 1) {
      throw new Error(`Expected one ${face} font file in the bundle, found ${matches.length}.`);
    }
    return `<link rel="preload" href="${base}${matches[0]}" as="font" type="font/woff2" crossorigin />`;
  });
}

// Build only: the dev server injects an inline React Refresh preamble that this policy would block,
// and the font preloads need the hashed file names that only a build produces.
function productionHead(): Plugin {
  let base = '/';
  return {
    name: 'securepaste:production-head',
    apply: 'build',
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml(html, context) {
      requireAnchor(html, CSP_ANCHOR, 'so the policy lands before the icon');
      requireAnchor(html, PRELOAD_ANCHOR, 'so the font preloads land before the stylesheet');
      const meta = `<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`;
      const preloads = fontPreloads(Object.keys(context.bundle ?? {}), base);
      return html
        .replace(CSP_ANCHOR, `${meta}\n    ${CSP_ANCHOR}`)
        .replace(PRELOAD_ANCHOR, `${preloads.join('\n    ')}\n    ${PRELOAD_ANCHOR}`);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, 'VITE_API_');
  const apiTarget = env.VITE_API_PROXY_TARGET ?? DEFAULT_API_PROXY_TARGET;

  return {
    plugins: [react(), productionHead()],
    build: {
      cssCodeSplit: false,
      manifest: true,
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
            css: { include: [/[\\/]src[\\/]styles[\\/](tokens|fonts)\.css/] },
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
