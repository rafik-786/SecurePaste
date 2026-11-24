import { Alert } from '../../components/Alert';
import { Countdown } from '../../components/Countdown';
import type { Countdown as CountdownState } from '../../hooks/useCountdown';
import { SIZE_LIMIT_LABEL } from '../../lib/format';
import type { CreateFailure } from './useCreateSubmission';

const TEXT_KEPT = 'Your text is still here.';

export interface CreateFailureAlertProps {
  readonly failure: CreateFailure;
  readonly countdown: CountdownState;
  readonly className?: string | undefined;
}

export function CreateFailureAlert({ failure, countdown, className }: CreateFailureAlertProps) {
  const shared = { focusKey: failure, className };

  switch (failure.kind) {
    case 'rate-limited':
      return (
        <Alert {...shared} variant="warning" title="Too many pastes from your network">
          <p>Nothing was created.</p>
          <p>
            <Countdown countdown={countdown} />
          </p>
          <p>{TEXT_KEPT}</p>
        </Alert>
      );
    case 'validation':
      return (
        <Alert {...shared} variant="danger" title="The server rejected this paste">
          <p>Nothing was created. {TEXT_KEPT} Copy it, then reload the page and try again.</p>
        </Alert>
      );
    case 'too-large':
      return (
        <Alert {...shared} variant="danger" title="This paste is too large">
          <p>
            The limit is {SIZE_LIMIT_LABEL} after encryption. {TEXT_KEPT} Shorten it and try again.
          </p>
        </Alert>
      );
    case 'network':
      return (
        <Alert {...shared} variant="danger" title="Could not reach the server">
          <p>{TEXT_KEPT} Check your connection and try again.</p>
        </Alert>
      );
    case 'encrypt-failed':
      return (
        <Alert {...shared} variant="danger" title="This browser could not encrypt the paste">
          <p>Nothing was sent. {TEXT_KEPT} Try again.</p>
        </Alert>
      );
    default:
      return (
        <Alert {...shared} variant="danger" title="The server hit an error">
          <p>{TEXT_KEPT} Try again in a moment.</p>
        </Alert>
      );
  }
}
