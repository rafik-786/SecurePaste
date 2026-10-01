import { useRef } from 'react';
import { useNavigate } from 'react-router';
import { deletePaste, peekPaste } from '../../api/client';
import { requestFailure } from '../../api/request';
import type { PeekResponse } from '../../api/types';
import { ActionRow } from '../../components/ActionRow';
import { Button } from '../../components/Button';
import { ExpiryTime } from '../../components/ExpiryTime';
import { TrashIcon } from '../../components/icons/icons';
import { PageHeading } from '../../components/PageHeading';
import { Panel } from '../../components/Panel';
import { SealStrip } from '../../components/SealStrip';
import { useNow } from '../../hooks/useNow';
import { viewsLeftLabel } from '../../lib/format';
import { PasteSkeleton } from '../shared/PasteSkeleton';
import { usePeekAttempt } from '../shared/usePeekAttempt';
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
        <Button variant="ghost" disabled={deleting} onClick={onKeep}>
          Keep it
        </Button>
      </ActionRow>
    </Panel>
  );
}

export function PasteDeleter({ id, deleteToken }: PasteDeleterProps) {
  const navigate = useNavigate();
  const deleting = useRef(false);
  const { state, setState, nextSignal, retry } = usePeekAttempt<DeleteState>(
    CHECKING,
    async (attempt) => {
      let peek: PeekResponse;
      try {
        peek = await peekPaste(id, attempt.nextSignal());
      } catch (error) {
        const failure = requestFailure(error);
        if (failure) {
          attempt.settle(peekFailureState(failure));
        }
        return;
      }
      attempt.settle({ kind: 'confirm', paste: deletablePaste(peek), deleting: false });
    },
  );

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
