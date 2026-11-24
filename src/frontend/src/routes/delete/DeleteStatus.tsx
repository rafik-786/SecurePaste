import { AlertIcon, FlameIcon, OfflineIcon, UnlinkIcon } from '../../components/icons/icons';
import { StatusPage } from '../../components/StatusPage';
import { CreatePasteLink } from '../shared/CreatePasteLink';
import { PasteDeletedStatus } from '../shared/PasteDeletedStatus';
import { RateLimitedStatus } from '../shared/RateLimitedStatus';
import { DELETE_OUTCOME_UNKNOWN, GONE_REASONS } from '../shared/statusCopy';
import { TryAgainButton } from '../shared/TryAgainButton';
import type { DeleteStatusState } from './deleteState';

const COPY_AGAIN = 'Nothing was deleted. Copy the full delete link again.';

export interface DeleteStatusProps {
  readonly state: DeleteStatusState;
  readonly onRetry: () => void;
}

export interface DeleteLinkProblemStatusProps {
  readonly problem: 'invalid-id' | 'incomplete';
}

export function DeleteLinkProblemStatus({ problem }: DeleteLinkProblemStatusProps) {
  return problem === 'invalid-id' ? (
    <StatusPage
      icon={UnlinkIcon}
      tone="neutral"
      title="This delete link is not valid"
      actions={<CreatePasteLink />}
    >
      <p>{COPY_AGAIN}</p>
    </StatusPage>
  ) : (
    <StatusPage
      icon={UnlinkIcon}
      tone="warning"
      title="This delete link is incomplete"
      actions={<CreatePasteLink />}
    >
      <p>The part after the # is missing or damaged. {COPY_AGAIN}</p>
    </StatusPage>
  );
}

export function DeleteStatus({ state, onRetry }: DeleteStatusProps) {
  const retry = <TryAgainButton onRetry={onRetry} />;

  switch (state.kind) {
    case 'deleted':
      return <PasteDeletedStatus action={<CreatePasteLink variant="primary" />} />;
    case 'wrong-token':
      return (
        <StatusPage
          icon={AlertIcon}
          tone="danger"
          title="This delete link doesn't match"
          actions={<CreatePasteLink />}
        >
          <p>Nothing was deleted. Use the delete link from when you created the paste.</p>
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
          <p>Nothing to delete.</p>
        </StatusPage>
      );
    case 'gone':
      return (
        <StatusPage
          icon={FlameIcon}
          tone="neutral"
          title="This paste is already gone"
          actions={<CreatePasteLink />}
        >
          <p>{GONE_REASONS}</p>
        </StatusPage>
      );
    case 'rate-limited':
      return (
        <RateLimitedStatus error={state.error} onRetry={onRetry}>
          Nothing was deleted.
        </RateLimitedStatus>
      );
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
        <StatusPage icon={OfflineIcon} tone="danger" title="The connection dropped" actions={retry}>
          <p>{DELETE_OUTCOME_UNKNOWN}</p>
        </StatusPage>
      ) : (
        <StatusPage icon={AlertIcon} tone="danger" title="The server hit an error" actions={retry}>
          <p>{DELETE_OUTCOME_UNKNOWN}</p>
        </StatusPage>
      );
  }
}
