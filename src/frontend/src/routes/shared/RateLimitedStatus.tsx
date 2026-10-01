import type { ReactNode } from 'react';
import type { ApiError } from '../../api/errors';
import { Countdown } from '../../components/Countdown';
import { ClockIcon } from '../../components/icons/icons';
import { StatusPage } from '../../components/StatusPage';
import { useCountdown } from '../../hooks/useCountdown';
import { TryAgainButton } from './TryAgainButton';

export interface RateLimitedStatusProps {
  readonly error: ApiError;
  readonly onRetry: () => void;
  readonly children: ReactNode;
  readonly actions?: ReactNode;
}

export function RateLimitedStatus({ error, onRetry, children, actions }: RateLimitedStatusProps) {
  const countdown = useCountdown(error);
  return (
    <StatusPage
      icon={ClockIcon}
      tone="warning"
      title="Too many requests"
      actions={
        <>
          <TryAgainButton onRetry={onRetry} waiting={!countdown.done} />
          {actions}
        </>
      }
    >
      <p>{children}</p>
      <p>
        <Countdown countdown={countdown} />
      </p>
    </StatusPage>
  );
}
