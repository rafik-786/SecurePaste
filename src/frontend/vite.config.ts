import react from '@vitejs/plugin-react';
import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const DEFAULT_API_PROXY_TARGET = 'http://localhost:5000';
const PROXIED_PATHS = ['/api', '/healthz', '/readyz'];

const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
].join('; ');

// Build only: the dev server injects an inline React Refresh preamble that this policy would block.
function contentSecurityPolicy(): Plugin {
  return {
    name: 'securepaste:content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
        injectTo: 'head-prepend',
      },
    ],
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, 'VITE_API_');
  const apiTarget = env.VITE_API_PROXY_TARGET ?? DEFAULT_API_PROXY_TARGET;

  return {
    plugins: [react(), contentSecurityPolicy()],
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
          },
        },
      ],
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx'],
        reporter: ['text', 'html'],
        thresholds: {
          'src/lib/**': { lines: 90 },
          'src/api/**': { lines: 90 },
        },
      },
    },
  };
});
