import { Fragment, type ReactNode } from 'react';
import { cx } from '../lib/classNames';
import { ClockIcon, EyeIcon, FlameIcon, LockIcon } from './icons/icons';
import type { IconComponent } from './icons/types';
import styles from './SealStrip.module.css';

export type SealState = 'sealed' | 'opened' | 'destroyed' | 'expired';

const SEALS: Readonly<Record<SealState, { readonly icon: IconComponent; readonly word: string }>> =
  {
    sealed: { icon: LockIcon, word: 'Sealed' },
    opened: { icon: EyeIcon, word: 'Opened' },
    destroyed: { icon: FlameIcon, word: 'Destroyed' },
    expired: { icon: ClockIcon, word: 'Expired' },
  };

export interface SealStripProps {
  readonly state: SealState;
  readonly items: readonly ReactNode[];
}

export function SealStrip({ state, items }: SealStripProps) {
  const { icon: Icon, word } = SEALS[state];

  return (
    <div className={cx(styles.strip, styles[state])}>
      <span className={styles.items}>
        <span className={styles.item}>
          <Icon />
          <span>{word}</span>
        </span>
        {items.map((item, index) => (
          <Fragment key={index}>
            {' '}
            <span className={styles.item}>{item}</span>
          </Fragment>
        ))}
      </span>
    </div>
  );
}
