import styles from './LabelSwap.module.css';

export interface LabelSwapProps {
  readonly active: string;
  readonly labels?: readonly (string | undefined)[];
}

export function LabelSwap({ active, labels = [] }: LabelSwapProps) {
  const all = [...new Set([active, ...labels])].filter((label) => label !== undefined);

  return (
    <span className={styles.swap}>
      {all.map((label) =>
        label === active ? (
          <span key={label} className={styles.label}>
            {label}
          </span>
        ) : (
          <span key={label} className={styles.hidden} aria-hidden="true">
            {label}
          </span>
        ),
      )}
    </span>
  );
}
