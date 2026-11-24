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
import { shareLinkHelp, viewsSettingLabel } from '../../lib/format';
import { formatAbsolute } from '../../lib/time';
import { DELETE_OUTCOME_UNKNOWN, GONE_REASONS } from '../shared/statusCopy';
import { LinkField } from './LinkField';
import type { CreatedPaste } from './links';
import styles from './CreateResult.module.css';

const DELETE_HELP = 'Shown once. Keep it to delete the paste before it expires.';
const DELETING_LABEL = 'Deleting...';

type Deletion =
  | { readonly step: 'idle' }
  | { readonly step: 'confirming' }
  | { readonly step: 'deleting' }
  | { readonly step: 'failed'; readonly failure: ApiError; readonly focusAlert: boolean }
  | { readonly step: 'gone' };

interface FocusRequest {
  readonly target: 'deleteNow' | 'deletePaste';
}

interface DeleteFailureAlertProps {
  readonly failure: ApiError;
  readonly focus: boolean;
  readonly countdown: CountdownState;
}

function DeleteFailureAlert({ failure, focus, countdown }: DeleteFailureAlertProps) {
  const focusKey = focus ? failure : undefined;
  switch (failure.kind) {
    case 'rate-limited':
      return (
        <Alert variant="warning" title="Too many requests" focusKey={focusKey}>
          <p>
            Nothing was deleted. <Countdown countdown={countdown} />
          </p>
        </Alert>
      );
    case 'network':
      return (
        <Alert variant="danger" title="Could not reach the server" focusKey={focusKey}>
          <p>{DELETE_OUTCOME_UNKNOWN}</p>
        </Alert>
      );
    default:
      return (
        <Alert variant="danger" title="The server hit an error" focusKey={focusKey}>
          <p>{DELETE_OUTCOME_UNKNOWN}</p>
        </Alert>
      );
  }
}

export interface CreateResultProps {
  readonly paste: CreatedPaste;
  readonly onCreateAnother: () => void;
  readonly onDeleted: () => void;
}

export function CreateResult({ paste, onCreateAnother, onDeleted }: CreateResultProps) {
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
    onDeleted();
  };

  const confirming =
    deletion.step === 'confirming' || deletion.step === 'deleting' || deletion.step === 'failed';

  return (
    <Panel
      className={styles.card}
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
      <LinkField
        heading="Share link"
        link={paste.shareLink}
        emphasis="primary"
        copyLabel="Copy link"
        copiedAnnouncement="Link copied to clipboard."
        description={shareLinkHelp(paste.maxViews)}
        copyRef={copyLinkRef}
      />
      <LinkField
        heading="Delete link"
        link={paste.deleteLink}
        emphasis="secondary"
        copyLabel="Copy"
        copyName="Copy delete link"
        copiedAnnouncement="Delete link copied to clipboard."
        description={DELETE_HELP}
        className={styles.deleteBox}
      />

      {failed && (
        <DeleteFailureAlert
          failure={failed.failure}
          focus={failed.focusAlert}
          countdown={countdown}
        />
      )}
      {deletion.step === 'gone' && (
        <Alert variant="info" title="This paste is already gone" focusKey="gone">
          <p>{GONE_REASONS}</p>
        </Alert>
      )}

      <div className={styles.footer}>
        {confirming ? (
          <>
            <p id={questionId} className={styles.question}>
              Delete this paste? The link will stop working.
            </p>
            <ActionRow className={styles.actions}>
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
          </>
        ) : (
          <>
            <p className={styles.expiry}>
              Expires{' '}
              <time dateTime={paste.expiresAt.toISOString()}>
                {formatAbsolute(paste.expiresAt)}
              </time>
            </p>
            <ActionRow className={styles.actions}>
              {deletion.step === 'idle' && (
                <Button ref={deleteNowRef} icon={TrashIcon} onClick={askToConfirm}>
                  Delete now
                </Button>
              )}
              <Button onClick={onCreateAnother}>Create another</Button>
            </ActionRow>
          </>
        )}
      </div>
    </Panel>
  );
}
