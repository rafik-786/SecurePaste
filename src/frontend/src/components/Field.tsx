import { useId, type ReactNode } from 'react';
import { joinIds } from '../lib/aria';
import { cx } from '../lib/classNames';
import { AlertIcon } from './icons/icons';
import styles from './Field.module.css';

export interface FieldControlProps {
  readonly id: string;
  readonly 'aria-describedby': string | undefined;
  readonly 'aria-invalid': true | undefined;
}

export interface FieldProps {
  readonly label: string;
  readonly error?: string | undefined;
  readonly describedBy?: string | undefined;
  readonly id?: string | undefined;
  readonly className?: string | undefined;
  readonly children: (control: FieldControlProps) => ReactNode;
}

export function Field({ label, error, describedBy: extra, id, className, children }: FieldProps) {
  const generated = useId();
  const controlId = id ?? generated;
  const errorId = `${controlId}-error`;
  const hasError = error !== undefined && error !== '';

  return (
    <div className={cx(styles.field, className)}>
      <label className={styles.label} htmlFor={controlId}>
        {label}
      </label>
      {children({
        id: controlId,
        'aria-describedby': joinIds(extra, hasError && errorId),
        'aria-invalid': hasError ? true : undefined,
      })}
      {hasError && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

export interface FieldErrorProps {
  readonly id: string;
  readonly children: ReactNode;
}

export function FieldError({ id, children }: FieldErrorProps) {
  return (
    <p id={id} className={styles.error}>
      <AlertIcon className={styles.errorIcon} />
      <span>
        <span className="visually-hidden">Error:</span> {children}
      </span>
    </p>
  );
}
