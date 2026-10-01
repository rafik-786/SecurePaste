import type { ReactNode } from 'react';
import { cx } from '../lib/classNames';
import styles from './Panel.module.css';

export interface PanelProps {
  readonly strip?: ReactNode;
  readonly children?: ReactNode;
  readonly className?: string | undefined;
  readonly bodyClassName?: string | undefined;
}

export function Panel({ strip, children, className, bodyClassName }: PanelProps) {
  return (
    <div className={cx(styles.panel, className)}>
      {strip}
      {children !== undefined && <div className={cx(styles.body, bodyClassName)}>{children}</div>}
    </div>
  );
}
