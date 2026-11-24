import { cx } from '../lib/classNames';
import styles from './SegmentedControl.module.css';

export interface SegmentOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

export interface SegmentedControlProps<T extends string> {
  readonly legend: string;
  readonly name: string;
  readonly options: readonly SegmentOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly busy?: boolean;
  readonly className?: string | undefined;
}

export function SegmentedControl<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  busy = false,
  className,
}: SegmentedControlProps<T>) {
  return (
    <fieldset className={cx(styles.group, className)} aria-disabled={busy || undefined}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.segments}>
        {options.map((option) => (
          <label key={option.value} className={styles.segment}>
            <input
              className={styles.input}
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => {
                if (!busy) {
                  onChange(option.value);
                }
              }}
            />
            <span className={styles.face}>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
