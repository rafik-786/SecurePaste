import { useId, useRef, useState, type Ref } from 'react';
import { CopyBlockedHint, CopyButton } from '../../components/CopyButton';
import { joinIds } from '../../lib/aria';
import { cx } from '../../lib/classNames';
import { NO_TRANSLATE_CLASS, SECRET_FIELD_PROPS } from '../../lib/leakPrevention';
import styles from './LinkField.module.css';

export type LinkEmphasis = 'primary' | 'secondary';

export interface LinkFieldProps {
  readonly heading: string;
  readonly link: string;
  readonly emphasis: LinkEmphasis;
  readonly copyLabel: string;
  readonly copyName?: string | undefined;
  readonly copiedAnnouncement: string;
  readonly description: string;
  readonly className?: string | undefined;
  readonly copyRef?: Ref<HTMLButtonElement>;
}

export function LinkField({
  heading,
  link,
  emphasis,
  copyLabel,
  copyName,
  copiedAnnouncement,
  description,
  className,
  copyRef,
}: LinkFieldProps) {
  const headingId = useId();
  const descriptionId = useId();
  const blockedId = useId();
  const field = useRef<HTMLInputElement>(null);
  const selectOnPointerUp = useRef(false);
  const [blocked, setBlocked] = useState(false);
  const primary = emphasis === 'primary';

  return (
    <div className={cx(styles.linkField, primary ? styles.primary : styles.secondary, className)}>
      <h2 id={headingId} className={styles.heading}>
        {heading}
      </h2>
      <div className={styles.row}>
        <input
          ref={field}
          type="text"
          readOnly
          value={link}
          className={cx(styles.input, NO_TRANSLATE_CLASS)}
          aria-labelledby={headingId}
          aria-describedby={joinIds(blocked && blockedId, descriptionId)}
          onFocus={(event) => {
            event.currentTarget.select();
          }}
          onPointerDown={(event) => {
            selectOnPointerUp.current = document.activeElement !== event.currentTarget;
          }}
          onPointerUp={(event) => {
            // The click that focuses the field places a caret after the focus handler selected all.
            if (selectOnPointerUp.current) {
              selectOnPointerUp.current = false;
              event.currentTarget.select();
            }
          }}
          {...SECRET_FIELD_PROPS}
        />
        <CopyButton
          ref={copyRef ?? null}
          variant={emphasis}
          size={primary ? 'lg' : 'md'}
          className={styles.copy}
          text={link}
          label={copyLabel}
          idleName={copyName}
          copiedAnnouncement={copiedAnnouncement}
          selectOnFailure={field}
          aria-describedby={descriptionId}
          onOutcome={(outcome) => {
            setBlocked(outcome === 'failed');
          }}
        />
      </div>
      {blocked && <CopyBlockedHint id={blockedId} className={styles.description} />}
      <p id={descriptionId} className={styles.description}>
        {description}
      </p>
    </div>
  );
}
