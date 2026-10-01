import type { ReactNode } from 'react';
import { cx } from '../lib/classNames';
import styles from './Panel.module.css';

export interface PanelProps {
  readonly strip?: ReactNode;
  readonly children?: ReactNode;
  readonly fullBleed?: boolean;
  readonly className?: string | undefined;
  readonly bodyClassName?: string | undefined;
}

export function Panel({
  strip,
  children,
  fullBleed = false,
  className,
  bodyClassName,
}: PanelProps) {
  return (
    <div className={cx(styles.panel, fullBleed && styles.fullBleed, className)}>
      {strip}
      {fullBleed
        ? children
        : children !== undefined && (
            <div className={cx(styles.body, bodyClassName)}>{children}</div>
          )}
    </div>
  );
}
