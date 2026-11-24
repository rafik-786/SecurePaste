import { useRef } from 'react';
import { Alert } from '../../components/Alert';
import { ExpiryTime } from '../../components/ExpiryTime';
import { FlameIcon } from '../../components/icons/icons';
import { Panel } from '../../components/Panel';
import { SealStrip } from '../../components/SealStrip';
import { useFocusOnChange } from '../../hooks/useFocusOnChange';
import { useLeaveGuard } from '../../hooks/leaveGuard';
import { useNow } from '../../hooks/useNow';
import { viewsLeftLabel } from '../../lib/format';
import { CodeViewer } from './CodeViewer/CodeViewer';
import type { OpenedPaste } from './readState';
import { useHasPassed } from './useHasPassed';
import styles from './ReadRoute.module.css';

const DESTROYED_FOCUS_KEY = 'destroyed';
const REVEALED_FOCUS_KEY = 'revealed';
const COPY_NOW = "Copy what you need now. The link won't open it again.";

export interface OpenedViewProps {
  readonly pasteId: string;
  readonly paste: OpenedPaste;
}

function OpenedStrip({ paste }: { readonly paste: OpenedPaste }) {
  const now = useNow();
  return (
    <SealStrip
      state="opened"
      items={[
        viewsLeftLabel(paste.remainingViews),
        <ExpiryTime key="expiry" expiresAt={paste.expiresAt} now={now} />,
      ]}
    />
  );
}

export function OpenedView({ pasteId, paste }: OpenedViewProps) {
  const region = useRef<HTMLPreElement>(null);
  const destroyed = paste.remainingViews === 0;
  const expired = useHasPassed(paste.expiresAt) && !destroyed;
  useLeaveGuard(destroyed || expired);
  useFocusOnChange(region, destroyed ? undefined : REVEALED_FOCUS_KEY, { afterLayout: true });

  return (
    <>
      {destroyed && (
        <Alert
          variant="danger"
          icon={FlameIcon}
          title="This paste is now destroyed"
          focusKey={DESTROYED_FOCUS_KEY}
        >
          {COPY_NOW}
        </Alert>
      )}
      {expired && (
        <Alert variant="warning" title="This paste has expired">
          {COPY_NOW}
        </Alert>
      )}
      <Panel
        fullBleed
        className={styles.pasteCard}
        strip={
          destroyed ? (
            <SealStrip state="destroyed" items={[viewsLeftLabel(paste.remainingViews)]} />
          ) : expired ? (
            <SealStrip state="expired" />
          ) : (
            <OpenedStrip paste={paste} />
          )
        }
      >
        <CodeViewer
          pasteId={pasteId}
          content={paste.content}
          language={paste.language}
          regionRef={region}
        />
      </Panel>
    </>
  );
}
