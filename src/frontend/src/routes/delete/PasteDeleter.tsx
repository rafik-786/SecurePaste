import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { deletePaste, peekPaste } from '../../api/client';
import { requestFailure } from '../../api/request';
import { ActionRow } from '../../components/ActionRow';
import { Button } from '../../components/Button';
import { ExpiryTime } from '../../components/ExpiryTime';
import { TrashIcon } from '../../components/icons/icons';
import { PageHeading } from '../../components/PageHeading';
import { Panel } from '../../components/Panel';
import { SealStrip } from '../../components/SealStrip';
import { useNow } from '../../hooks/useNow';
import { useRequestSignal } from '../../hooks/useRequestSignal';
import { viewsLeftLabel } from '../../lib/format';
import { PasteSkeleton } from '../paste/PasteSkeleton';
import {
  CHECKING,
  DELETED,
  deletablePaste,
  deleteFailureState,
  peekFailureState,
  type DeletablePaste,
  type DeleteState,
} from './deleteState';
import { DeleteStatus } from './DeleteStatus';
import styles from './DeleteRoute.module.css';

const CHECKING_HEADING = 'Delete paste';
const CONFIRM_HEADING = 'Delete this paste?';
const CHECKING_LABEL = 'Checking the paste...';
const DELETING_LABEL = 'Deleting...';

export interface PasteDeleterProps {
  readonly id: string;
  readonly deleteToken: string;
}

interface ConfirmPanelProps {
  readonly paste: DeletablePaste;
  readonly deleting: boolean;
  readonly onDelete: () => void;
  readonly onKeep: () => void;
}

function ConfirmPanel({ paste, deleting, onDelete, onKeep }: ConfirmPanelProps) {
  const now = useNow();
  return (
    <Panel
      strip={
        <SealStrip
          state="sealed"
          items={[
            viewsLeftLabel(paste.remainingViews),
            <ExpiryTime key="expiry" expiresAt={paste.expiresAt} now={now} />,
          ]}
        />
      }
      bodyClassName={styles.confirmBody}
    >
      <p>
        Deleting destroys the encrypted content on the server now. Anyone who opens the share link
        afterwards will see that the paste is gone. This cannot be undone.
      </p>
      <ActionRow className={styles.actions}>
        <Button
          variant="danger"
          icon={TrashIcon}
          busyLabel={deleting ? DELETING_LABEL : undefined}
          reserveLabels={[DELETING_LABEL]}
          onClick={onDelete}
        >
          Delete paste
        </Button>
        <Button variant="ghost" onClick={onKeep}>
          Keep it
        </Button>
      </ActionRow>
    </Panel>
  );
}

export function PasteDeleter({ id, deleteToken }: PasteDeleterProps) {
  const navigate = useNavigate();
  const nextSignal = useRequestSignal();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<DeleteState>(CHECKING);
  const deleting = useRef(false);

  useEffect(() => {
    const stale = new AbortController();
    const isStale = () => stale.signal.aborted;

    void peekPaste(id, nextSignal()).then(
      (peek) => {
        if (!isStale()) {
          setState({ kind: 'confirm', paste: deletablePaste(peek), deleting: false });
        }
      },
      (error: unknown) => {
        const failure = requestFailure(error);
        if (!isStale() && failure) {
          setState(peekFailureState(failure));
        }
      },
    );
    return () => {
      stale.abort();
    };
  }, [attempt, id, nextSignal]);

  const retry = useCallback(() => {
    setState(CHECKING);
    setAttempt((previous) => previous + 1);
  }, []);

  switch (state.kind) {
    case 'checking':
      return (
        <div className={styles.page}>
          <PageHeading>{CHECKING_HEADING}</PageHeading>
          <PasteSkeleton label={CHECKING_LABEL} bodyClassName={styles.confirmBody} />
        </div>
      );
    case 'confirm': {
      const confirmDelete = () => {
        if (deleting.current) {
          return;
        }
        deleting.current = true;
        setState({ ...state, deleting: true });
        void deletePaste(id, deleteToken, nextSignal()).then(
          () => {
            deleting.current = false;
            setState(DELETED);
          },
          (error: unknown) => {
            deleting.current = false;
            const failure = requestFailure(error);
            if (failure) {
              setState(deleteFailureState(failure));
            }
          },
        );
      };
      return (
        <div className={styles.page}>
          <PageHeading>{CONFIRM_HEADING}</PageHeading>
          <ConfirmPanel
            paste={state.paste}
            deleting={state.deleting}
            onDelete={confirmDelete}
            onKeep={() => {
              void navigate('/');
            }}
          />
        </div>
      );
    }
    default:
      return <DeleteStatus state={state} onRetry={retry} />;
  }
}
