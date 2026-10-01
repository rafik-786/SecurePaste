import { useEffect } from 'react';

export const PRODUCT_NAME = 'SecurePaste';

export function documentTitleFor(heading: string): string {
  return `${heading} - ${PRODUCT_NAME}`;
}

export function useDocumentTitle(heading: string): void {
  useEffect(() => {
    document.title = documentTitleFor(heading);
  }, [heading]);
}
