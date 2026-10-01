import type { ComponentPropsWithRef } from 'react';
import { cx } from '../lib/classNames';
import { NO_TRANSLATE_CLASS, SECRET_FIELD_PROPS } from '../lib/leakPrevention';
import styles from './TextArea.module.css';

type LeakProneProps =
  'spellCheck' | 'autoComplete' | 'autoCapitalize' | 'autoCorrect' | 'translate';

export type TextAreaProps = Omit<ComponentPropsWithRef<'textarea'>, LeakProneProps>;

export function TextArea({ className, ...rest }: TextAreaProps) {
  return (
    <textarea
      {...rest}
      {...SECRET_FIELD_PROPS}
      className={cx(styles.textArea, NO_TRANSLATE_CLASS, className)}
    />
  );
}
