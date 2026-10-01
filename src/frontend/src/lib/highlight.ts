import type { HLJSApi, LanguageFn } from 'highlight.js';
import type { LanguageId } from './languages';

type HighlightedLanguageId = Exclude<LanguageId, 'plaintext'>;
type LanguageLoader = () => Promise<{ default: LanguageFn }>;

const LANGUAGE_LOADERS: Readonly<Record<HighlightedLanguageId, LanguageLoader>> = {
  bash: () => import('highlight.js/lib/languages/bash'),
  c: () => import('highlight.js/lib/languages/c'),
  cpp: () => import('highlight.js/lib/languages/cpp'),
  csharp: () => import('highlight.js/lib/languages/csharp'),
  css: () => import('highlight.js/lib/languages/css'),
  diff: () => import('highlight.js/lib/languages/diff'),
  dockerfile: () => import('highlight.js/lib/languages/dockerfile'),
  go: () => import('highlight.js/lib/languages/go'),
  xml: () => import('highlight.js/lib/languages/xml'),
  java: () => import('highlight.js/lib/languages/java'),
  javascript: () => import('highlight.js/lib/languages/javascript'),
  json: () => import('highlight.js/lib/languages/json'),
  kotlin: () => import('highlight.js/lib/languages/kotlin'),
  markdown: () => import('highlight.js/lib/languages/markdown'),
  php: () => import('highlight.js/lib/languages/php'),
  python: () => import('highlight.js/lib/languages/python'),
  ruby: () => import('highlight.js/lib/languages/ruby'),
  rust: () => import('highlight.js/lib/languages/rust'),
  sql: () => import('highlight.js/lib/languages/sql'),
  swift: () => import('highlight.js/lib/languages/swift'),
  typescript: () => import('highlight.js/lib/languages/typescript'),
  yaml: () => import('highlight.js/lib/languages/yaml'),
};

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
};

let pendingCore: Promise<HLJSApi> | undefined;
const pendingLanguages = new Map<HighlightedLanguageId, Promise<HLJSApi>>();

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

function isHighlighted(language: string): language is HighlightedLanguageId {
  return Object.hasOwn(LANGUAGE_LOADERS, language);
}

function loadCore(): Promise<HLJSApi> {
  if (!pendingCore) {
    const loading = import('highlight.js/lib/core').then((module) => module.default);
    loading.catch(() => {
      pendingCore = undefined;
    });
    pendingCore = loading;
  }
  return pendingCore;
}

function loadLanguage(id: HighlightedLanguageId): Promise<HLJSApi> {
  let loading = pendingLanguages.get(id);
  if (!loading) {
    loading = Promise.all([loadCore(), LANGUAGE_LOADERS[id]()]).then(([hljs, language]) => {
      hljs.registerLanguage(id, language.default);
      return hljs;
    });
    loading.catch(() => pendingLanguages.delete(id));
    pendingLanguages.set(id, loading);
  }
  return loading;
}

export async function highlight(code: string, language: string): Promise<string> {
  if (!isHighlighted(language)) {
    return escapeHtml(code);
  }
  try {
    const hljs = await loadLanguage(language);
    return hljs.highlight(code, { language, ignoreIllegals: true }).value;
  } catch {
    // A chunk that fails to load (offline, or stale after a deploy) degrades to plain text.
    return escapeHtml(code);
  }
}
