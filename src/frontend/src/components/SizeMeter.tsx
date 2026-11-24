import { useEffect, useRef } from 'react';
import { useAnnounce } from '../hooks/announcer';
import { cx } from '../lib/classNames';
import { sizeMeterState, sizeMeterText, sizeThresholdAnnouncement } from '../lib/format';
import { MAX_CIPHERTEXT_BYTES } from '../lib/limits';
import { AlertIcon } from './icons/icons';
import styles from './SizeMeter.module.css';

export const SIZE_METER_LABEL = 'Size after encryption';

export interface SizeMeterProps {
  readonly id: string;
  readonly bytes: number;
  readonly className?: string | undefined;
}

export function SizeMeter({ id, bytes, className }: SizeMeterProps) {
  const announce = useAnnounce();
  const state = sizeMeterState(bytes);
  const previous = useRef(state);

  useEffect(() => {
    const message = sizeThresholdAnnouncement(previous.current, state);
    previous.current = state;
    if (message !== undefined) {
      announce(message);
    }
  }, [state, announce]);

  return (
    <div className={cx(styles.meter, styles[state], className)}>
      <div className={styles.track} aria-hidden="true">
        <div
          className={styles.fill}
          style={{ '--meter-fill': Math.min(1, bytes / MAX_CIPHERTEXT_BYTES) }}
        />
      </div>
      <p id={id} className={styles.labels}>
        <span className={styles.label}>{SIZE_METER_LABEL}</span>{' '}
        <span className={styles.value}>
          {state === 'over' && <AlertIcon />}
          {sizeMeterText(bytes)}
        </span>
      </p>
    </div>
  );
}
