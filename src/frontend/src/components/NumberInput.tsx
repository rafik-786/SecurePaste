import type { ComponentPropsWithRef, KeyboardEvent } from 'react';
import { cx } from '../lib/classNames';
import { parseWholeNumber } from '../lib/numbers';
import styles from './NumberInput.module.css';

export interface NumberInputProps extends Omit<
  ComponentPropsWithRef<'input'>,
  'type' | 'value' | 'onChange' | 'inputMode' | 'pattern' | 'maxLength' | 'min' | 'max'
> {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly min: number;
  readonly max: number;
  readonly onActivate?: () => void;
}

export function NumberInput({
  value,
  onValueChange,
  min,
  max,
  onActivate,
  className,
  onFocus,
  onKeyDown,
  ...rest
}: NumberInputProps) {
  const step = (delta: number) => {
    const current = parseWholeNumber(value);
    const next = current === undefined ? min : Math.min(max, Math.max(min, current + delta));
    onValueChange(String(next));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      step(event.key === 'ArrowUp' ? 1 : -1);
    }
  };

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={String(max).length}
      autoComplete="off"
      value={value}
      className={cx(styles.input, className)}
      onChange={(event) => {
        onActivate?.();
        onValueChange(event.target.value);
      }}
      onFocus={(event) => {
        onActivate?.();
        onFocus?.(event);
      }}
      onKeyDown={handleKeyDown}
    />
  );
}
