import type { ComponentPropsWithRef } from 'react';
import { cx } from '../lib/classNames';
import { ChevronDownIcon } from './icons/icons';
import styles from './Select.module.css';

export type SelectProps = ComponentPropsWithRef<'select'>;

export function Select({ className, ...rest }: SelectProps) {
  return (
    <div className={cx(styles.wrapper, className)}>
      <select {...rest} className={styles.select} />
      <ChevronDownIcon className={styles.chevron} />
    </div>
  );
}
