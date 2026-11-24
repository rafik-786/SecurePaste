import { useEffect, useState } from 'react';
import { cx } from '../lib/classNames';
import styles from './Spinner.module.css';

export const SPINNER_DELAY_MS = 300;

export interface SpinnerProps {
  readonly size?: 16 | 24;
  readonly className?: string | undefined;
}

export function Spinner({ size = 16, className }: SpinnerProps) {
  return (
    <span
      className={cx(styles.spinner, size === 24 && styles.large, className)}
      aria-hidden="true"
    />
  );
}

export interface LoadingStatusProps {
  readonly label: string;
  readonly className?: string | undefined;
}

export function LoadingStatus({ label, className }: LoadingStatusProps) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShown(true);
    }, SPINNER_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div role="status" className={cx(styles.status, className)}>
      {shown && (
        <>
          <Spinner size={24} />
          <span>{label}</span>
        </>
      )}
    </div>
  );
}
