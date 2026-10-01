import { useEffect, useRef, useState, type Ref, type RefObject } from 'react';
import { useAnnounce } from '../hooks/announcer';
import { copyBlockedAnnouncement, copyBlockedHint } from '../lib/format';
import { isApplePlatform } from '../lib/platform';
import { Button, type ButtonSize, type ButtonVariant } from './Button';
import { AlertIcon, CheckIcon, CopyIcon } from './icons/icons';
import type { IconProps } from './icons/types';
import styles from './CopyButton.module.css';

export const COPY_FEEDBACK_MS = 2_000;
export const COPIED_LABEL = 'Copied';
export const COPY_FAILED_LABEL = 'Copy failed';

export type CopyOutcome = 'copied' | 'failed';

function CopiedIcon(props: IconProps) {
  return <CheckIcon {...props} className={styles.copied} />;
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function selectForManualCopy(element: HTMLElement): void {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.focus();
    element.select();
    return;
  }
  window.getSelection()?.selectAllChildren(element);
}

export interface CopyButtonProps {
  readonly text: string;
  readonly label: string;
  readonly copiedAnnouncement: string;
  readonly selectOnFailure?: RefObject<HTMLElement | null>;
  readonly onOutcome?: (outcome: CopyOutcome) => void;
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly className?: string | undefined;
  readonly 'aria-describedby'?: string | undefined;
  readonly ref?: Ref<HTMLButtonElement>;
}

export function CopyButton({
  text,
  label,
  copiedAnnouncement,
  selectOnFailure,
  onOutcome,
  variant = 'secondary',
  size = 'md',
  className,
  'aria-describedby': describedBy,
  ref,
}: CopyButtonProps) {
  const announce = useAnnounce();
  const [outcome, setOutcome] = useState<CopyOutcome | undefined>(undefined);
  const timer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    const copied = await writeClipboard(text);
    const next: CopyOutcome = copied ? 'copied' : 'failed';
    if (!copied && selectOnFailure?.current) {
      selectForManualCopy(selectOnFailure.current);
    }
    window.clearTimeout(timer.current);
    setOutcome(next);
    timer.current = window.setTimeout(() => {
      setOutcome(undefined);
    }, COPY_FEEDBACK_MS);
    announce(copied ? copiedAnnouncement : copyBlockedAnnouncement(isApplePlatform()));
    onOutcome?.(next);
  };

  const shown =
    outcome === 'copied'
      ? { icon: CopiedIcon, text: COPIED_LABEL }
      : outcome === 'failed'
        ? { icon: AlertIcon, text: COPY_FAILED_LABEL }
        : { icon: CopyIcon, text: label };

  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={className}
      icon={shown.icon}
      reserveLabels={[label, COPIED_LABEL, COPY_FAILED_LABEL]}
      aria-describedby={describedBy}
      onClick={() => {
        void copy();
      }}
    >
      {shown.text}
    </Button>
  );
}

export interface CopyBlockedHintProps {
  readonly id?: string | undefined;
  readonly className?: string | undefined;
}

export function CopyBlockedHint({ id, className }: CopyBlockedHintProps) {
  return (
    <p id={id} className={className ?? styles.hint}>
      {copyBlockedHint(isApplePlatform())}
    </p>
  );
}
