import { Alert } from '../../components/Alert';
import { Countdown } from '../../components/Countdown';
import type { Countdown as CountdownState } from '../../hooks/useCountdown';
import { SIZE_LIMIT_LABEL } from '../../lib/format';
import type { CreateFailure } from './useCreateSubmission';

const TEXT_KEPT = 'Your text is still here.';
const NO_DETAIL = 'The request was not valid.';

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
          <p>
            {failure.detail !== undefined && failure.detail.trim() !== ''
              ? failure.detail
              : NO_DETAIL}
          </p>
          <p>{TEXT_KEPT}</p>
        </Alert>
      );
    case 'too-large':
      return (
        <Alert {...shared} variant="danger" title="This paste is too large">
          <p>
            The server accepts up to {SIZE_LIMIT_LABEL} after encryption. Shorten the text and try
            again. {TEXT_KEPT}
          </p>
        </Alert>
      );
    case 'network':
      return (
        <Alert {...shared} variant="danger" title="Could not reach the server">
          <p>
            Check your connection and try again. {TEXT_KEPT} If the request did reach the server,
            that paste has no link anywhere and expires on its own.
          </p>
        </Alert>
      );
    case 'encrypt-failed':
      return (
        <Alert {...shared} variant="danger" title="This browser could not encrypt the paste">
          <p>Nothing was sent. Try again. {TEXT_KEPT}</p>
        </Alert>
      );
    default:
      return (
        <Alert {...shared} variant="danger" title="The server hit an error">
          <p>Try again in a moment. {TEXT_KEPT}</p>
        </Alert>
      );
  }
}
