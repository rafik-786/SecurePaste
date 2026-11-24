export interface Language {
  readonly id: string;
  readonly label: string;
  readonly extension: string;
}

export const LANGUAGES = [
  { id: 'plaintext', label: 'Plain text', extension: 'txt' },
  { id: 'bash', label: 'Bash', extension: 'sh' },
  { id: 'c', label: 'C', extension: 'c' },
  { id: 'cpp', label: 'C++', extension: 'cpp' },
  { id: 'csharp', label: 'C#', extension: 'cs' },
  { id: 'css', label: 'CSS', extension: 'css' },
  { id: 'diff', label: 'Diff', extension: 'diff' },
  { id: 'dockerfile', label: 'Dockerfile', extension: 'dockerfile' },
  { id: 'go', label: 'Go', extension: 'go' },
  { id: 'xml', label: 'HTML / XML', extension: 'html' },
  { id: 'java', label: 'Java', extension: 'java' },
  { id: 'javascript', label: 'JavaScript', extension: 'js' },
  { id: 'json', label: 'JSON', extension: 'json' },
  { id: 'kotlin', label: 'Kotlin', extension: 'kt' },
  { id: 'markdown', label: 'Markdown', extension: 'md' },
  { id: 'php', label: 'PHP', extension: 'php' },
  { id: 'python', label: 'Python', extension: 'py' },
  { id: 'ruby', label: 'Ruby', extension: 'rb' },
  { id: 'rust', label: 'Rust', extension: 'rs' },
  { id: 'sql', label: 'SQL', extension: 'sql' },
  { id: 'swift', label: 'Swift', extension: 'swift' },
  { id: 'typescript', label: 'TypeScript', extension: 'ts' },
  { id: 'yaml', label: 'YAML', extension: 'yaml' },
] as const satisfies readonly Language[];

export type LanguageId = (typeof LANGUAGES)[number]['id'];

export const DEFAULT_LANGUAGE = 'plaintext' satisfies LanguageId;

const LANGUAGES_BY_ID: ReadonlyMap<string, Language> = new Map(
  LANGUAGES.map((language) => [language.id, language]),
);

export function isKnownLanguage(id: string): id is LanguageId {
  return LANGUAGES_BY_ID.has(id);
}

export function findLanguage(id: string): Language | undefined {
  return LANGUAGES_BY_ID.get(id);
}
