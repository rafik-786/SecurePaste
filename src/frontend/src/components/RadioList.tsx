import { useId, type ReactNode } from 'react';
import { cx } from '../lib/classNames';
import { FieldError } from './Field';
import styles from './RadioList.module.css';

export interface RadioOption<T extends string> {
  readonly value: T;
  readonly label: ReactNode;
  readonly hint: string;
}

export interface RadioListProps<T extends string> {
  readonly legend: string;
  readonly name: string;
  readonly options: readonly RadioOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly error?: string | undefined;
  readonly errorId?: string | undefined;
  readonly busy?: boolean;
  readonly className?: string | undefined;
}

export function RadioList<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  error,
  errorId,
  busy = false,
  className,
}: RadioListProps<T>) {
  const baseId = useId();
  const generatedErrorId = `${baseId}-error`;

  return (
    <fieldset className={cx(styles.group, className)} aria-disabled={busy || undefined}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.rows}>
        {options.map((option) => {
          const labelId = `${baseId}-${option.value}-label`;
          const hintId = `${baseId}-${option.value}-hint`;
          return (
            <label key={option.value} className={styles.row}>
              <span className={styles.choice}>
                <input
                  className={styles.radio}
                  type="radio"
                  name={name}
                  value={option.value}
                  checked={option.value === value}
                  aria-labelledby={labelId}
                  aria-describedby={hintId}
                  onChange={() => {
                    if (!busy) {
                      onChange(option.value);
                    }
                  }}
                />
                <span id={labelId} className={styles.label}>
                  {option.label}
                </span>
              </span>
              <span id={hintId} className={styles.hint}>
                {option.hint}
              </span>
            </label>
          );
        })}
      </div>
      {error !== undefined && error !== '' && (
        <FieldError id={errorId ?? generatedErrorId}>{error}</FieldError>
      )}
    </fieldset>
  );
}
