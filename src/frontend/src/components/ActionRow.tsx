import type { ReactNode } from 'react';
import { cx } from '../lib/classNames';
import styles from './ActionRow.module.css';

export interface ActionRowProps {
  readonly children: ReactNode;
  readonly className?: string | undefined;
}

export function ActionRow({ children, className }: ActionRowProps) {
  return <div className={cx(styles.row, className)}>{children}</div>;
}
