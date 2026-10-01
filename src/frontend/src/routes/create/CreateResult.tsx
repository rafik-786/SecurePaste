import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { deletePaste } from '../../api/client';
import type { ApiError } from '../../api/errors';
import { requestFailure } from '../../api/request';
import { ActionRow } from '../../components/ActionRow';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Countdown } from '../../components/Countdown';
import { ExpiryTime } from '../../components/ExpiryTime';
import { TrashIcon } from '../../components/icons/icons';
import { Panel } from '../../components/Panel';
import { SealStrip } from '../../components/SealStrip';
import { useCountdown, type Countdown as CountdownState } from '../../hooks/useCountdown';
import { useNow } from '../../hooks/useNow';
import { useRequestSignal } from '../../hooks/useRequestSignal';
import { viewsSettingLabel, viewsSettingSentence } from '../../lib/format';
import { formatAbsolute } from '../../lib/time';
import { LinkField } from './LinkField';
import type { CreatedPaste } from './links';
import styles from './CreateResult.module.css';

const SHARE_WARNING =
  'Anyone with this link can read the paste. The part after the # is the key, so send the whole link over a channel you trust.';
const DELETE_HINT =
  'Opens a page where you can delete the paste early. This is the only time it is shown: reloading or leaving this page clears it.';
const DELETING_LABEL = 'Deleting...';

type Deletion =
  | { readonly step: 'idle' }
  | { readonly step: 'confirming' }
  | { readonly step: 'deleting' }
  | { readonly step: 'failed'; readonly failure: ApiError; readonly focusAlert: boolean }
  | { readonly step: 'gone' }
  | { readonly step: 'deleted' };

interface FocusRequest {
  readonly target: 'deleteNow' | 'deletePaste';
}

interface DeleteFailureAlertProps {
  readonly failure: ApiError;
  readonly focus: boolean;
  readonly countdown: CountdownState;
  readonly expiresAt: string;
}

function DeleteFailureAlert({ failure, focus, countdown, expiresAt }: DeleteFailureAlertProps) {
  const focusKey = focus ? failure : undefined;
  switch (failure.kind) {
    case 'rate-limited':
      return (
        <Alert variant="warning" title="Too many requests" focusKey={focusKey}>
          <p>
            <Countdown countdown={countdown} />
          </p>
        </Alert>
      );
    case 'network':
      return (
        <Alert variant="danger" title="Could not reach the server" focusKey={focusKey}>
          <p>The paste may not be deleted yet. Try again.</p>
        </Alert>
      );
    default:
      return (
        <Alert variant="danger" title="The paste could not be deleted" focusKey={focusKey}>
          <p>{`The server answered with an error. Try again, or let it expire on its own at ${expiresAt}.`}</p>
        </Alert>
      );
  }
}

export interface CreateResultProps {
  readonly paste: CreatedPaste;
  readonly onCreateAnother: () => void;
}

export function CreateResult({ paste, onCreateAnother }: CreateResultProps) {
  const now = useNow();
  const copyLinkRef = useRef<HTMLButtonElement>(null);
  const deleteNowRef = useRef<HTMLButtonElement>(null);
  const deletePasteRef = useRef<HTMLButtonElement>(null);
  const questionId = useId();
  const [deletion, setDeletion] = useState<Deletion>({ step: 'idle' });
  const [focusRequest, setFocusRequest] = useState<FocusRequest | undefined>(undefined);
  const [rateLimit, setRateLimit] = useState<ApiError | undefined>(undefined);
  const inFlight = useRef(false);
  const requestSignal = useRequestSignal();
  const failed = deletion.step === 'failed' ? deletion : undefined;
  const countdown = useCountdown(rateLimit);
  const absoluteExpiry = formatAbsolute(paste.expiresAt);

  useEffect(() => {
    copyLinkRef.current?.focus();
  }, []);

  useEffect(() => {
    if (focusRequest) {
      (focusRequest.target === 'deleteNow' ? deleteNowRef : deletePasteRef).current?.focus();
    }
  }, [focusRequest]);

  const askToConfirm = () => {
    setDeletion(
      rateLimit && !countdown.done
        ? { step: 'failed', failure: rateLimit, focusAlert: false }
        : { step: 'confirming' },
    );
    setFocusRequest({ target: 'deletePaste' });
  };

  const cancel = () => {
    if (deletion.step === 'deleting') {
      return;
    }
    setDeletion({ step: 'idle' });
    setFocusRequest({ target: 'deleteNow' });
  };

  const cancelOnEscape = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
    }
  };

  const remove = async () => {
    if (inFlight.current || !countdown.done) {
      return;
    }
    inFlight.current = true;
    const signal = requestSignal();
    setDeletion({ step: 'deleting' });
    try {
      await deletePaste(paste.id, paste.deleteToken, signal);
    } catch (error) {
      inFlight.current = false;
      const failure = requestFailure(error);
      if (failure?.kind === 'rate-limited') {
        setRateLimit(failure);
      }
      if (failure) {
        setDeletion(
          failure.kind === 'gone'
            ? { step: 'gone' }
            : { step: 'failed', failure, focusAlert: true },
        );
      }
      return;
    }
    inFlight.current = false;
    setDeletion({ step: 'deleted' });
  };

  const createAnother = (
    <Button
      onClick={() => {
        onCreateAnother();
      }}
    >
      Create another
    </Button>
  );

  if (deletion.step === 'deleted') {
    return (
      <div className={styles.deleted}>
        <Alert variant="success" title="Paste deleted" focusKey="deleted">
          <p>
            The encrypted content is destroyed. The share link now shows that the paste is gone.
          </p>
        </Alert>
        <ActionRow>{createAnother}</ActionRow>
      </div>
    );
  }

  const confirming =
    deletion.step === 'confirming' || deletion.step === 'deleting' || deletion.step === 'failed';

  return (
    <Panel
      className={styles.panel}
      bodyClassName={styles.body}
      strip={
        <SealStrip
          state="sealed"
          items={[
            viewsSettingLabel(paste.maxViews),
            <ExpiryTime expiresAt={paste.expiresAt} now={now} />,
          ]}
        />
      }
    >
      <div className={styles.links}>
        <LinkField
          heading="Share link"
          link={paste.shareLink}
          copyLabel="Copy link"
          copiedAnnouncement="Link copied to clipboard."
          description={`${SHARE_WARNING} ${viewsSettingSentence(paste.maxViews)}`}
          copyRef={copyLinkRef}
        />
        <LinkField
          heading="Delete link"
          link={paste.deleteLink}
          copyLabel="Copy delete link"
          copiedAnnouncement="Delete link copied to clipboard."
          description={DELETE_HINT}
        />
      </div>
      <p className={styles.expiry}>
        Expires at <time dateTime={paste.expiresAt.toISOString()}>{absoluteExpiry}</time>, your
        local time.
      </p>

      {failed && (
        <DeleteFailureAlert
          failure={failed.failure}
          focus={failed.focusAlert}
          countdown={countdown}
          expiresAt={absoluteExpiry}
        />
      )}
      {deletion.step === 'gone' && (
        <Alert variant="info" title="This paste is already gone" focusKey="gone">
          <p>It was opened for the last time, expired, or was deleted.</p>
        </Alert>
      )}

      {confirming ? (
        <div className={styles.confirm}>
          <p id={questionId}>Delete this paste now? The share link will show that it is gone.</p>
          <ActionRow>
            <Button
              ref={deletePasteRef}
              variant="danger"
              icon={TrashIcon}
              busyLabel={deletion.step === 'deleting' ? DELETING_LABEL : undefined}
              reserveLabels={[DELETING_LABEL]}
              disabled={!countdown.done}
              aria-describedby={questionId}
              onClick={() => {
                void remove();
              }}
              onKeyDown={cancelOnEscape}
            >
              Delete paste
            </Button>
            <Button
              variant="ghost"
              disabled={deletion.step === 'deleting'}
              onClick={cancel}
              onKeyDown={cancelOnEscape}
            >
              Cancel
            </Button>
          </ActionRow>
        </div>
      ) : (
        <ActionRow>
          {deletion.step === 'idle' && (
            <Button ref={deleteNowRef} icon={TrashIcon} onClick={askToConfirm}>
              Delete now
            </Button>
          )}
          {createAnother}
        </ActionRow>
      )}
    </Panel>
  );
}
