import type { ReactNode } from 'react';
import { cx } from '../../lib/classNames';
import type { IconProps } from './types';
import styles from './SvgIcon.module.css';

export function SvgIcon({ size = 16, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={cx(styles.icon, className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}
