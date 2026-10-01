import type { ReactNode } from 'react';
import { cx } from '../lib/classNames';
import styles from './Kbd.module.css';

export interface KbdProps {
  readonly children: ReactNode;
  readonly className?: string | undefined;
}

export function Kbd({ children, className }: KbdProps) {
  return <kbd className={cx(styles.kbd, className)}>{children}</kbd>;
}
