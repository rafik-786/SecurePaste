import type { ReactNode } from 'react';
import { cx } from '../lib/classNames';
import { ActionRow } from './ActionRow';
import type { IconComponent } from './icons/types';
import { PageHeading } from './PageHeading';
import styles from './StatusPage.module.css';

export type StatusTone = 'neutral' | 'warning' | 'danger' | 'success' | 'info';

export interface StatusPageProps {
  readonly icon: IconComponent;
  readonly tone: StatusTone;
  readonly title: string;
  readonly children?: ReactNode;
  readonly actions?: ReactNode;
  readonly className?: string | undefined;
}

export function StatusPage({
  icon: Icon,
  tone,
  title,
  children,
  actions,
  className,
}: StatusPageProps) {
  return (
    <div className={cx(styles.status, className)}>
      <Icon size={32} className={cx(styles.icon, styles[tone])} />
      <PageHeading className={styles.title}>{title}</PageHeading>
      {children !== undefined && <div className={styles.body}>{children}</div>}
      {actions !== undefined && <ActionRow className={styles.actions}>{actions}</ActionRow>}
    </div>
  );
}
