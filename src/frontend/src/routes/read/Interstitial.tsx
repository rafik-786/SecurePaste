import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ExpiryTime } from '../../components/ExpiryTime';
import { EyeIcon, FlameIcon } from '../../components/icons/icons';
import { Panel } from '../../components/Panel';
import { SealStrip } from '../../components/SealStrip';
import { useNow } from '../../hooks/useNow';
import { formatEncryptedSize, revealCostSentence, viewsLeftLabel } from '../../lib/format';
import type { RevealStep, SealedPeek } from './readState';
import styles from './ReadRoute.module.css';

const REVEALING_LABEL = 'Revealing...';
const DECRYPTING_LABEL = 'Decrypting...';

const BUSY_LABELS: Readonly<Record<RevealStep, string | undefined>> = {
  idle: undefined,
  revealing: REVEALING_LABEL,
  decrypting: DECRYPTING_LABEL,
};

export interface InterstitialProps {
  readonly peek: SealedPeek;
  readonly step: RevealStep;
  readonly onReveal: () => void;
}

export function Interstitial({ peek, step, onReveal }: InterstitialProps) {
  const now = useNow();
  const lastView = peek.remainingViews <= 1;
  const icon = lastView ? FlameIcon : EyeIcon;

  return (
    <Panel
      strip={
        <SealStrip
          state="sealed"
          items={[
            viewsLeftLabel(peek.remainingViews),
            <ExpiryTime key="expiry" expiresAt={peek.expiresAt} now={now} />,
            `${formatEncryptedSize(peek.sizeBytes)} encrypted`,
          ]}
        />
      }
      bodyClassName={styles.sealedBody}
    >
      <Alert variant={lastView ? 'warning' : 'info'} icon={icon} className={styles.callout}>
        {revealCostSentence(peek.remainingViews)}
      </Alert>
      <Button
        variant="primary"
        size="lg"
        icon={icon}
        className={styles.reveal}
        busyLabel={BUSY_LABELS[step]}
        reserveLabels={[REVEALING_LABEL, DECRYPTING_LABEL]}
        onClick={onReveal}
      >
        {lastView ? 'Reveal and destroy' : 'Reveal paste'}
      </Button>
      <p className={styles.note}>
        Decryption happens in this browser. The key in the link never reaches the server.
      </p>
    </Panel>
  );
}
