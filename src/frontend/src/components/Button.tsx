import type { ComponentPropsWithRef, MouseEvent } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cx } from '../lib/classNames';
import type { IconComponent } from './icons/types';
import { LabelSwap } from './LabelSwap';
import { Spinner } from './Spinner';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonLook {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly icon?: IconComponent | undefined;
  readonly children: string;
  readonly className?: string | undefined;
}

export interface ButtonProps
  extends ButtonLook, Omit<ComponentPropsWithRef<'button'>, 'children' | 'disabled' | 'className'> {
  readonly disabled?: boolean;
  readonly busyLabel?: string | undefined;
  readonly reserveLabels?: readonly string[];
}

export interface LinkButtonProps extends ButtonLook, Omit<LinkProps, 'children' | 'className'> {}

function buttonClass(
  variant: ButtonVariant,
  size: ButtonSize,
  ...extra: (string | false | undefined)[]
) {
  return cx(styles.button, styles[variant], styles[size], ...extra);
}

function iconSize(size: ButtonSize) {
  return size === 'lg' ? 20 : 16;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  children,
  className,
  disabled = false,
  busyLabel,
  reserveLabels = [],
  type = 'button',
  onClick,
  ...rest
}: ButtonProps) {
  const busy = busyLabel !== undefined;
  const inert = disabled || busy;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (inert) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <button
      {...rest}
      type={type}
      className={buttonClass(
        variant,
        size,
        disabled && styles.disabled,
        busy && styles.busy,
        className,
      )}
      aria-disabled={inert || undefined}
      onClick={handleClick}
    >
      {busy ? (
        <span className={styles.iconSlot}>
          <Spinner />
        </span>
      ) : (
        Icon && <Icon size={iconSize(size)} />
      )}
      <LabelSwap active={busyLabel ?? children} labels={[children, ...reserveLabels]} />
    </button>
  );
}

export function LinkButton({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  children,
  className,
  ...rest
}: LinkButtonProps) {
  return (
    <Link {...rest} className={buttonClass(variant, size, className)}>
      {Icon && <Icon size={iconSize(size)} />}
      <span>{children}</span>
    </Link>
  );
}
