import { useId, useRef, type ReactNode } from 'react';
import { useFocusOnChange } from '../hooks/useFocusOnChange';
import { cx } from '../lib/classNames';
import { AlertIcon, CheckIcon, InfoIcon } from './icons/icons';
import type { IconComponent } from './icons/types';
import styles from './Alert.module.css';

export type AlertVariant = 'info' | 'warning' | 'danger' | 'success';

const DEFAULT_ICONS: Readonly<Record<AlertVariant, IconComponent>> = {
  info: InfoIcon,
  warning: AlertIcon,
  danger: AlertIcon,
  success: CheckIcon,
};

export interface AlertProps {
  readonly variant: AlertVariant;
  readonly title?: string | undefined;
  readonly children?: ReactNode;
  readonly actions?: ReactNode;
  readonly icon?: IconComponent | undefined;
  readonly focusKey?: unknown;
  readonly id?: string | undefined;
  readonly className?: string | undefined;
}

export function Alert({
  variant,
  title,
  children,
  actions,
  icon,
  focusKey,
  id,
  className,
}: AlertProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const hasTitle = title !== undefined;
  const Icon = icon ?? DEFAULT_ICONS[variant];
  useFocusOnChange(ref, focusKey);

  return (
    <div
      ref={ref}
      id={id}
      className={cx(styles.alert, styles[variant], className)}
      role={hasTitle ? 'group' : undefined}
      aria-labelledby={hasTitle ? titleId : undefined}
      tabIndex={focusKey === undefined ? undefined : -1}
    >
      <Icon size={20} className={styles.icon} />
      <div className={styles.content}>
        {hasTitle && (
          <p id={titleId} className={styles.title}>
            {title}
          </p>
        )}
        {children !== undefined && <div className={styles.body}>{children}</div>}
        {actions !== undefined && <div className={styles.actions}>{actions}</div>}
      </div>
    </div>
  );
}
