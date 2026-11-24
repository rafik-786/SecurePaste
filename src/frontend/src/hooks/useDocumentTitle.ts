import { useEffect } from 'react';
import { PRODUCT_NAME } from '../lib/product';

export function documentTitleFor(heading: string): string {
  return `${heading} - ${PRODUCT_NAME}`;
}

export function useDocumentTitle(heading: string): void {
  useEffect(() => {
    document.title = documentTitleFor(heading);
  }, [heading]);
}
