import { useId, useRef, useState, type Ref } from 'react';
import { CopyBlockedHint, CopyButton } from '../../components/CopyButton';
import { joinIds } from '../../lib/aria';
import { cx } from '../../lib/classNames';
import { NO_TRANSLATE_CLASS, SECRET_FIELD_PROPS } from '../../lib/leakPrevention';
import styles from './LinkField.module.css';

export interface LinkFieldProps {
  readonly heading: string;
  readonly link: string;
  readonly copyLabel: string;
  readonly copiedAnnouncement: string;
  readonly description: string;
  readonly copyRef?: Ref<HTMLButtonElement>;
}

export function LinkField({
  heading,
  link,
  copyLabel,
  copiedAnnouncement,
  description,
  copyRef,
}: LinkFieldProps) {
  const headingId = useId();
  const descriptionId = useId();
  const blockedId = useId();
  const field = useRef<HTMLInputElement>(null);
  const selectOnPointerUp = useRef(false);
  const [blocked, setBlocked] = useState(false);

  return (
    <div className={styles.linkField}>
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
          className={styles.copy}
          text={link}
          label={copyLabel}
          copiedAnnouncement={copiedAnnouncement}
          selectOnFailure={field}
          aria-describedby={descriptionId}
          onOutcome={(outcome) => {
            setBlocked(outcome === 'failed');
          }}
        />
      </div>
      {blocked && <CopyBlockedHint id={blockedId} />}
      <p id={descriptionId} className={styles.description}>
        {description}
      </p>
    </div>
  );
}
