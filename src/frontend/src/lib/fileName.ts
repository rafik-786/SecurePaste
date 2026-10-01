import { findLanguage } from './languages';

const FALLBACK_EXTENSION = 'txt';

export function downloadFileName(id: string, language: string): string {
  return `paste-${id}.${findLanguage(language)?.extension ?? FALLBACK_EXTENSION}`;
}
