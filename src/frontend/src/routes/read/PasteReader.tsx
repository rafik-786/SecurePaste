import { useCallback, useEffect, useRef, useState } from 'react';
import { claimView, peekPaste } from '../../api/client';
import { requestFailure } from '../../api/request';
import type { ClaimResponse, PeekResponse } from '../../api/types';
import { PageHeading } from '../../components/PageHeading';
import { useRequestSignal } from '../../hooks/useRequestSignal';
import { decryptPaste, parseKey } from '../../lib/crypto';
import { preloadHighlighter } from '../../lib/highlight';
import { PasteSkeleton } from '../paste/PasteSkeleton';
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

export function PasteReader({ id, fragmentKey }: PasteReaderProps) {
  const nextSignal = useRequestSignal();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ReadState>(CHECKING);
  const autoClaimedAttempt = useRef<number | null>(null);
  const claiming = useRef(false);

  const claimAndDecrypt = useCallback(
    async (key: CryptoKey, onDecrypting: () => void): Promise<ReadState | undefined> => {
      let claim: ClaimResponse;
      try {
        claim = await claimView(id, nextSignal());
      } catch (error) {
        const failure = requestFailure(error);
        return failure && claimFailureState(failure);
      }
      onDecrypting();
      try {
        return {
          kind: 'open',
          paste: openedPaste(await decryptPaste(claim.ciphertext, key), claim),
        };
      } catch {
        return { kind: 'corrupted', remainingViews: claim.remainingViews };
      }
    },
    [id, nextSignal],
  );

  useEffect(() => {
    const stale = new AbortController();
    const isStale = () => stale.signal.aborted;

    const check = async () => {
      let key: CryptoKey;
      try {
        key = await parseKey(fragmentKey);
      } catch {
        if (!isStale()) {
          setState({ kind: 'incomplete' });
        }
        return;
      }
      if (isStale()) {
        return;
      }

      preloadHighlighter();
      let peek: PeekResponse;
      try {
        peek = await peekPaste(id, nextSignal());
      } catch (error) {
        const failure = requestFailure(error);
        if (!isStale() && failure) {
          setState(peekFailureState(failure));
        }
        return;
      }
      if (isStale()) {
        return;
      }

      if (peek.remainingViews !== null) {
        setState({
          kind: 'sealed',
          peek: sealedPeek(peek, peek.remainingViews),
          key,
          step: 'idle',
        });
        return;
      }
      if (autoClaimedAttempt.current === attempt) {
        return;
      }
      autoClaimedAttempt.current = attempt;
      setState(OPENING);
      const next = await claimAndDecrypt(key, () => undefined);
      if (!isStale() && next) {
        setState(next);
      }
    };

    void check();
    return () => {
      stale.abort();
    };
  }, [attempt, fragmentKey, id, nextSignal, claimAndDecrypt]);

  const retry = useCallback(() => {
    setState(CHECKING);
    setAttempt((previous) => previous + 1);
  }, []);

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
        void claimAndDecrypt(state.key, () => {
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
        <div className={styles.page}>
          <PageHeading>{READ_HEADING}</PageHeading>
          <OpenedView pasteId={id} paste={state.paste} />
        </div>
      );
    default:
      return <ReadStatus state={state} onRetry={retry} />;
  }
}
