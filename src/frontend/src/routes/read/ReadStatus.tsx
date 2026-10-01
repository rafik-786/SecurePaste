import { AlertIcon, FlameIcon, OfflineIcon, UnlinkIcon } from '../../components/icons/icons';
import { StatusPage } from '../../components/StatusPage';
import { viewsRemainSentence } from '../../lib/format';
import { CreatePasteLink } from '../shared/CreatePasteLink';
import { RateLimitedStatus } from '../shared/RateLimitedStatus';
import { TryAgainButton } from '../shared/TryAgainButton';
import type { ReadStatusState } from './readState';

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
      <p>
        The paste ID in this link is malformed, so there is nothing to look up. Check that the whole
        link was copied. Nothing was used.
      </p>
    </StatusPage>
  ) : (
    <StatusPage
      icon={UnlinkIcon}
      tone="warning"
      title="This link is incomplete"
      actions={<CreatePasteLink />}
    >
      <p>
        The part after the # is missing or damaged. That part is the decryption key, so the paste
        cannot be opened without it. Ask the sender for the full link. No view was used.
      </p>
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
          <p>
            The link may be mistyped, or the paste expired a while ago and was cleaned up. Check the
            link with the sender.
          </p>
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
          <p>It expired, reached its view limit, or was deleted. SecurePaste does not say which.</p>
          <p>
            If you have not opened this link before, tell the sender: someone else may have read it.
          </p>
        </StatusPage>
      );
    case 'corrupted': {
      const viewsSentence = viewsRemainSentence(state.remainingViews);
      return (
        <StatusPage
          icon={AlertIcon}
          tone="danger"
          title="Corrupted data or wrong key"
          actions={<CreatePasteLink />}
        >
          <p>
            The paste could not be decrypted, so nothing is shown. A partial result could be
            misleading.
          </p>
          <p>
            {viewsSentence === undefined
              ? 'This view was counted.'
              : `This view was counted. ${viewsSentence}`}
          </p>
          <p>Ask the sender to check the link, or to create a new paste.</p>
        </StatusPage>
      );
    }
    case 'rate-limited':
      return (
        <RateLimitedStatus error={state.error} onRetry={onRetry} actions={<CreatePasteLink />}>
          Your network has made too many requests in the last minute. No view was used.
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
          <p>Check your connection and try again. Nothing was used.</p>
        </StatusPage>
      ) : (
        <StatusPage icon={AlertIcon} tone="danger" title="The server hit an error" actions={retry}>
          <p>Try again in a moment. Nothing was used.</p>
        </StatusPage>
      );
    case 'reveal-failed':
      return state.cause === 'network' ? (
        <StatusPage
          icon={OfflineIcon}
          tone="danger"
          title="The connection dropped while revealing"
          actions={retry}
        >
          <p>
            If the request reached the server, a view may have been used. Try again to see what is
            left.
          </p>
        </StatusPage>
      ) : (
        <StatusPage icon={AlertIcon} tone="danger" title="The server hit an error" actions={retry}>
          <p>A view may have been used. Try again to see what is left.</p>
        </StatusPage>
      );
  }
}
