import { useRef } from 'react';
import { claimView, peekPaste } from '../../api/client';
import { requestFailure } from '../../api/request';
import type { ClaimResponse, PeekResponse } from '../../api/types';
import { PageHeading } from '../../components/PageHeading';
import { cx } from '../../lib/classNames';
import { decryptPaste, parseKey } from '../../lib/crypto';
import { preloadHighlighter } from '../../lib/highlight';
import { PasteSkeleton } from '../shared/PasteSkeleton';
import { usePeekAttempt, type AttemptRun } from '../shared/usePeekAttempt';
import { Interstitial } from './Interstitial';
import { OpenedView } from './OpenedView';
import {
  CHECKING,
  claimFailureState,
  OPENING,
  openedPaste,
  peekFailureState,
  sealedPeek,
  type ReadState,
} from './readState';
import { ReadStatus } from './ReadStatus';
import styles from './ReadRoute.module.css';

const READ_HEADING = 'Encrypted paste';
const CHECKING_LABEL = 'Checking the link...';
const OPENING_LABEL = 'Decrypting...';

export interface PasteReaderProps {
  readonly id: string;
  readonly fragmentKey: string;
}

async function claimAndDecrypt(
  id: string,
  key: CryptoKey,
  signal: AbortSignal,
  onDecrypting: () => void,
): Promise<ReadState | undefined> {
  let claim: ClaimResponse;
  try {
    claim = await claimView(id, signal);
  } catch (error) {
    const failure = requestFailure(error);
    return failure && claimFailureState(failure);
  }
  onDecrypting();
  try {
    return { kind: 'open', paste: openedPaste(await decryptPaste(claim.ciphertext, key), claim) };
  } catch {
    return { kind: 'corrupted', remainingViews: claim.remainingViews };
  }
}

async function checkLink(
  id: string,
  fragmentKey: string,
  attempt: AttemptRun<ReadState>,
): Promise<void> {
  let key: CryptoKey;
  try {
    key = await parseKey(fragmentKey);
  } catch {
    attempt.settle({ kind: 'incomplete' });
    return;
  }
  if (attempt.isStale()) {
    return;
  }

  preloadHighlighter();
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
  if (attempt.isStale()) {
    return;
  }

  if (peek.remainingViews !== null) {
    attempt.settle({
      kind: 'sealed',
      peek: sealedPeek(peek, peek.remainingViews),
      key,
      step: 'idle',
    });
    return;
  }
  attempt.settle(OPENING);
  const next = await claimAndDecrypt(id, key, attempt.nextSignal(), () => undefined);
  if (next) {
    attempt.settle(next);
  }
}

export function PasteReader({ id, fragmentKey }: PasteReaderProps) {
  const claiming = useRef(false);
  const { state, setState, nextSignal, retry } = usePeekAttempt<ReadState>(CHECKING, (attempt) =>
    checkLink(id, fragmentKey, attempt),
  );

  switch (state.kind) {
    case 'checking':
    case 'opening':
      return (
        <div className={styles.page}>
          <PageHeading>{READ_HEADING}</PageHeading>
          <PasteSkeleton
            label={state.kind === 'checking' ? CHECKING_LABEL : OPENING_LABEL}
            bodyClassName={styles.sealedBody}
          />
        </div>
      );
    case 'sealed': {
      const reveal = () => {
        if (claiming.current) {
          return;
        }
        claiming.current = true;
        setState({ ...state, step: 'revealing' });
        void claimAndDecrypt(id, state.key, nextSignal(), () => {
          setState({ ...state, step: 'decrypting' });
        }).then((next) => {
          claiming.current = false;
          if (next) {
            setState(next);
          }
        });
      };
      return (
        <div className={styles.page}>
          <PageHeading>{READ_HEADING}</PageHeading>
          <Interstitial peek={state.peek} step={state.step} onReveal={reveal} />
        </div>
      );
    }
    case 'open':
      return (
        <div className={cx(styles.page, styles.opened)}>
          <PageHeading>{READ_HEADING}</PageHeading>
          <OpenedView pasteId={id} paste={state.paste} />
        </div>
      );
    default:
      return <ReadStatus state={state} onRetry={retry} />;
  }
}
