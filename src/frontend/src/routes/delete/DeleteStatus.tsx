import type { ApiError } from '../../api/errors';
import { Countdown } from '../../components/Countdown';
import {
  AlertIcon,
  CheckIcon,
  ClockIcon,
  FlameIcon,
  OfflineIcon,
  UnlinkIcon,
} from '../../components/icons/icons';
import { StatusPage } from '../../components/StatusPage';
import { useCountdown } from '../../hooks/useCountdown';
import { TryAgainButton } from '../paste/TryAgainButton';
import { CreatePasteLink } from '../shared/CreatePasteLink';
import type { DeleteStatusState } from './deleteState';

export interface DeleteStatusProps {
  readonly state: DeleteStatusState;
  readonly onRetry: () => void;
}

export interface DeleteLinkProblemStatusProps {
  readonly problem: 'invalid-id' | 'incomplete';
}

interface RateLimitedStatusProps {
  readonly error: ApiError;
  readonly onRetry: () => void;
}

export function DeleteLinkProblemStatus({ problem }: DeleteLinkProblemStatusProps) {
  return problem === 'invalid-id' ? (
    <StatusPage
      icon={UnlinkIcon}
      tone="neutral"
      title="This delete link is not valid"
      actions={<CreatePasteLink />}
    >
      <p>
        The paste ID in this link is malformed, so there is nothing to delete. Check that the whole
        link was copied.
      </p>
    </StatusPage>
  ) : (
    <StatusPage
      icon={UnlinkIcon}
      tone="warning"
      title="This delete link is incomplete"
      actions={<CreatePasteLink />}
    >
      <p>
        The part after the # is missing or damaged. That part is the delete token, so nothing can be
        deleted without it. Copy the full delete link again from where you saved it.
      </p>
    </StatusPage>
  );
}

function RateLimitedStatus({ error, onRetry }: RateLimitedStatusProps) {
  const countdown = useCountdown(error);
  return (
    <StatusPage
      icon={ClockIcon}
      tone="warning"
      title="Too many requests"
      actions={<TryAgainButton onRetry={onRetry} waiting={!countdown.done} />}
    >
      <p>Nothing was deleted.</p>
      <p>
        <Countdown countdown={countdown} />
      </p>
    </StatusPage>
  );
}

export function DeleteStatus({ state, onRetry }: DeleteStatusProps) {
  const retry = <TryAgainButton onRetry={onRetry} />;

  switch (state.kind) {
    case 'deleted':
      return (
        <StatusPage
          icon={CheckIcon}
          tone="success"
          title="Paste deleted"
          actions={<CreatePasteLink variant="primary" />}
        >
          <p>
            The encrypted content is destroyed. The share link now shows that the paste is gone.
          </p>
        </StatusPage>
      );
    case 'wrong-token':
      return (
        <StatusPage
          icon={AlertIcon}
          tone="danger"
          title="This delete link does not match"
          actions={<CreatePasteLink />}
        >
          <p>
            The delete token in the link is wrong for this paste, so nothing was deleted. Use the
            delete link shown when the paste was created.
          </p>
        </StatusPage>
      );
    case 'not-found':
      return (
        <StatusPage
          icon={UnlinkIcon}
          tone="neutral"
          title="No paste at this link"
          actions={<CreatePasteLink />}
        >
          <p>
            Nothing to delete. The link may be mistyped, or the paste expired and was cleaned up.
          </p>
        </StatusPage>
      );
    case 'already-gone':
      return (
        <StatusPage
          icon={FlameIcon}
          tone="neutral"
          title="This paste is already gone"
          actions={<CreatePasteLink />}
        >
          <p>
            It expired, was opened for the last time, or was deleted. There is nothing left to
            delete.
          </p>
        </StatusPage>
      );
    case 'rate-limited':
      return <RateLimitedStatus error={state.error} onRetry={onRetry} />;
    case 'check-failed':
      return state.cause === 'network' ? (
        <StatusPage
          icon={OfflineIcon}
          tone="danger"
          title="Could not reach the server"
          actions={retry}
        >
          <p>Nothing was deleted. Check your connection and try again.</p>
        </StatusPage>
      ) : (
        <StatusPage icon={AlertIcon} tone="danger" title="The server hit an error" actions={retry}>
          <p>Nothing was deleted. Try again in a moment.</p>
        </StatusPage>
      );
    case 'delete-failed':
      return state.cause === 'network' ? (
        <StatusPage
          icon={OfflineIcon}
          tone="danger"
          title="The connection dropped while deleting"
          actions={retry}
        >
          <p>
            The paste may or may not be deleted. Try again: if it was, you will see that it is gone.
          </p>
        </StatusPage>
      ) : (
        <StatusPage icon={AlertIcon} tone="danger" title="The server hit an error" actions={retry}>
          <p>The paste may not be deleted. Try again in a moment.</p>
        </StatusPage>
      );
  }
}
