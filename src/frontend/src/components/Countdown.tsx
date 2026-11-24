import type { Countdown as CountdownState } from '../hooks/useCountdown';
import { TRY_AGAIN_NOW_MESSAGE } from '../hooks/useCountdown';
import { cx } from '../lib/classNames';
import { formatSeconds } from '../lib/format';
import styles from './Countdown.module.css';

export interface CountdownProps {
  readonly countdown: CountdownState;
  readonly className?: string | undefined;
}

export function Countdown({ countdown, className }: CountdownProps) {
  return (
    <span className={cx(styles.countdown, className)}>
      {countdown.done
        ? TRY_AGAIN_NOW_MESSAGE
        : `You can try again in ${formatSeconds(countdown.secondsLeft)}.`}
    </span>
  );
}
