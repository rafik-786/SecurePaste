import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { useNavigationFocus } from '../hooks/navigationFocus';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export interface PageHeadingProps {
  readonly children: string;
  readonly focusOnTextChange?: boolean;
  readonly className?: string | undefined;
}

export function PageHeading({ children, focusOnTextChange = true, className }: PageHeadingProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  const { key } = useLocation();
  const { recordHeading } = useNavigationFocus();
  useDocumentTitle(children);

  useEffect(() => {
    const previous = recordHeading({ locationKey: key, text: children });
    if (previous === null) {
      return;
    }
    const routeChanged = previous.locationKey !== key;
    const textChanged = previous.text !== children;
    if (routeChanged || (textChanged && focusOnTextChange)) {
      ref.current?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  }, [children, key, recordHeading, focusOnTextChange]);

  return (
    <h1 ref={ref} tabIndex={-1} className={className}>
      {children}
    </h1>
  );
}
