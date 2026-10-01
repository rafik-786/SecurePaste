import type { ComponentPropsWithRef } from 'react';
import { cx } from '../lib/classNames';
import type { IconComponent } from './icons/types';
import styles from './IconButton.module.css';

export interface IconButtonProps extends Omit<
  ComponentPropsWithRef<'button'>,
  'children' | 'aria-label' | 'title' | 'type'
> {
  readonly label: string;
  readonly icon: IconComponent;
}

export function IconButton({ label, icon: Icon, className, ...rest }: IconButtonProps) {
  return (
    <button
      {...rest}
      type="button"
      aria-label={label}
      title={label}
      className={cx(styles.iconButton, className)}
    >
      <Icon size={20} />
    </button>
  );
}
