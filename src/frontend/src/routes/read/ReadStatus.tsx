import { AlertIcon, FlameIcon, OfflineIcon, UnlinkIcon } from '../../components/icons/icons';
import { StatusPage } from '../../components/StatusPage';
import { viewsRemainSentence } from '../../lib/format';
import { CreatePasteLink } from '../shared/CreatePasteLink';
import { RateLimitedStatus } from '../shared/RateLimitedStatus';
import { GONE_REASONS } from '../shared/statusCopy';
import { TryAgainButton } from '../shared/TryAgainButton';
import type { ReadStatusState } from './readState';

const ASK_FOR_FULL_LINK = 'Ask the sender for the full link.';
const VIEW_MAY_BE_USED = "A view may have been used. Try again to see what's left.";
const DECRYPT_FAILED = "The key doesn't match, or the data was changed. A view was used.";

export interface ReadStatusProps {
  readonly state: ReadStatusState;
  readonly onRetry: () => void;
}

export interface LinkProblemStatusProps {
  readonly problem: 'invalid-id' | 'incomplete';
}

export function LinkProblemStatus({ problem }: LinkProblemStatusProps) {
  return problem === 'invalid-id' ? (
    <StatusPage
      icon={UnlinkIcon}
      tone="neutral"
      title="This link is not valid"
      actions={<CreatePasteLink />}
    >
      <p>No view was used. {ASK_FOR_FULL_LINK}</p>
    </StatusPage>
  ) : (
    <StatusPage
      icon={UnlinkIcon}
      tone="warning"
      title="This link is incomplete"
      actions={<CreatePasteLink />}
    >
      <p>The part after the # is missing or damaged. No view was used. {ASK_FOR_FULL_LINK}</p>
    </StatusPage>
  );
}

export function ReadStatus({ state, onRetry }: ReadStatusProps) {
  const retry = <TryAgainButton onRetry={onRetry} />;

  switch (state.kind) {
    case 'incomplete':
      return <LinkProblemStatus problem="incomplete" />;
    case 'not-found':
      return (
        <StatusPage
          icon={UnlinkIcon}
          tone="neutral"
          title="No paste at this link"
          actions={<CreatePasteLink />}
        >
          <p>Check the link with the sender.</p>
        </StatusPage>
      );
    case 'gone':
      return (
        <StatusPage
          icon={FlameIcon}
          tone="danger"
          title="This paste is gone"
          actions={<CreatePasteLink />}
        >
          <p>{GONE_REASONS}</p>
          <p>
            If you haven't opened this link before, tell the sender. Someone else may have read it.
          </p>
        </StatusPage>
      );
    case 'corrupted': {
      const viewsSentence = viewsRemainSentence(state.remainingViews);
      return (
        <StatusPage
          icon={AlertIcon}
          tone="danger"
          title="This paste could not be decrypted"
          actions={<CreatePasteLink />}
        >
          <p>
            {viewsSentence === undefined ? DECRYPT_FAILED : `${DECRYPT_FAILED} ${viewsSentence}`}
          </p>
          <p>Ask the sender for a new link.</p>
        </StatusPage>
      );
    }
    case 'rate-limited':
      return (
        <RateLimitedStatus error={state.error} onRetry={onRetry} actions={<CreatePasteLink />}>
          No view was used.
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
          <p>No view was used. Check your connection and try again.</p>
        </StatusPage>
      ) : (
        <StatusPage icon={AlertIcon} tone="danger" title="The server hit an error" actions={retry}>
          <p>No view was used. Try again in a moment.</p>
        </StatusPage>
      );
    case 'reveal-failed':
      return state.cause === 'network' ? (
        <StatusPage icon={OfflineIcon} tone="danger" title="The connection dropped" actions={retry}>
          <p>{VIEW_MAY_BE_USED}</p>
        </StatusPage>
      ) : (
        <StatusPage icon={AlertIcon} tone="danger" title="The server hit an error" actions={retry}>
          <p>{VIEW_MAY_BE_USED}</p>
        </StatusPage>
      );
  }
}
