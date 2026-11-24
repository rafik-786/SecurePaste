import { useEffect, useId, useRef, useState } from 'react';
import { ActionRow } from '../../components/ActionRow';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { LockIcon } from '../../components/icons/icons';
import { NumberInput } from '../../components/NumberInput';
import { Panel } from '../../components/Panel';
import { RadioList, type RadioOption } from '../../components/RadioList';
import { SegmentedControl } from '../../components/SegmentedControl';
import { Select } from '../../components/Select';
import { SizeMeter } from '../../components/SizeMeter';
import { TextArea } from '../../components/TextArea';
import { useEncryptedSize } from '../../hooks/useEncryptedSize';
import { formatShortcut } from '../../lib/format';
import { isKnownLanguage, LANGUAGES } from '../../lib/languages';
import { EXPIRY_OPTIONS, MAX_VIEWS, MIN_VIEWS } from '../../lib/limits';
import {
  hasFinePointer,
  isApplePlatform,
  isSubmitShortcut,
  SUBMIT_KEY_SHORTCUTS,
} from '../../lib/platform';
import { CreateFailureAlert } from './CreateFailureAlert';
import { viewCountUnit, type CreateOptions, type ViewsChoice } from './formOptions';
import type { CreatedPaste } from './links';
import { ENCRYPTING_LABEL, UPLOADING_LABEL, useCreateSubmission } from './useCreateSubmission';
import styles from './CreateForm.module.css';

const SUBMIT_LABEL = 'Encrypt and create link';
const BUSY_LABELS = [ENCRYPTING_LABEL, UPLOADING_LABEL];

const EXPIRY_SEGMENTS = EXPIRY_OPTIONS.map(({ id, label }) => ({ value: id, label }));

export interface CreateFormProps {
  readonly options: CreateOptions;
  readonly onOptionsChange: (options: CreateOptions) => void;
  readonly onCreated: (paste: CreatedPaste) => void;
  readonly focusContentOnMount: boolean;
}

export function CreateForm({
  options,
  onOptionsChange,
  onCreated,
  focusContentOnMount,
}: CreateFormProps) {
  const meterId = useId();
  const viewCountErrorId = useId();
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const viewCountRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const form = useCreateSubmission({
    contentRef,
    viewCountRef,
    submitRef,
    options,
    onOptionsChange,
    onCreated,
  });
  const bytes = useEncryptedSize(form.content, options.language);
  const [shortcutHint] = useState(() =>
    hasFinePointer() ? formatShortcut('Enter', isApplePlatform()) : undefined,
  );

  useEffect(() => {
    if (focusContentOnMount) {
      contentRef.current?.focus();
    }
  }, [focusContentOnMount, contentRef]);

  const viewsOptions: readonly RadioOption<ViewsChoice>[] = [
    { value: 'burn', label: 'Burn after reading' },
    {
      value: 'limit',
      label: (
        <>
          Limit to{' '}
          <NumberInput
            ref={viewCountRef}
            aria-label="Number of views"
            aria-invalid={form.viewCountProblem !== undefined || undefined}
            aria-describedby={form.viewCountProblem === undefined ? undefined : viewCountErrorId}
            // Out of the tab order until Limit is chosen: focusing it selects Limit, so tabbing
            // past it would silently swap burn after reading for five views.
            tabIndex={options.views === 'limit' ? undefined : -1}
            readOnly={form.busy}
            value={options.viewCount}
            min={MIN_VIEWS}
            max={MAX_VIEWS}
            onValueChange={form.changeViewCount}
            onActivate={() => {
              if (options.views !== 'limit') {
                form.changeOptions({ ...options, views: 'limit' });
              }
            }}
            onBlur={form.blurViewCount}
          />{' '}
          {viewCountUnit(options.viewCount)}
        </>
      ),
    },
    { value: 'unlimited', label: 'Unlimited' },
  ];

  return (
    <>
      <p className={styles.lead}>Encrypted in your browser. The server never sees the key.</p>
      {/* One card holds the whole form in the stacked layout and two cards split it in app mode.
          Each wrapper that is not a card in the current layout is display: contents. The alert
          sits in the editor card because only the text area there can give up height. */}
      <Panel className={styles.card} bodyClassName={styles.cardBody}>
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Ctrl+Enter is delegated from the controls inside; the form itself never takes focus. */}
        <form
          className={styles.form}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            form.submit();
          }}
          onKeyDown={(event) => {
            if (isSubmitShortcut(event)) {
              event.preventDefault();
              form.submit();
            }
          }}
        >
          <Panel className={styles.editor} bodyClassName={styles.editorBody}>
            <Field
              label="Content"
              error={form.contentProblem}
              describedBy={meterId}
              className={styles.contentField}
            >
              {(control) => (
                <>
                  <TextArea
                    {...control}
                    ref={contentRef}
                    className={styles.content}
                    value={form.content}
                    placeholder="Paste text or code here"
                    readOnly={form.busy}
                    onChange={(event) => {
                      form.changeContent(event.target.value);
                    }}
                    onBlur={form.blurContent}
                  />
                  <SizeMeter id={meterId} bytes={bytes} />
                </>
              )}
            </Field>
            {form.failure && (
              <CreateFailureAlert
                failure={form.failure}
                countdown={form.countdown}
                className={styles.failure}
              />
            )}
          </Panel>

          <Panel className={styles.settings} bodyClassName={styles.settingsBody}>
            <div className={styles.choices}>
              <div className={styles.options}>
                <Field label="Language">
                  {(control) => (
                    <Select
                      {...control}
                      value={options.language}
                      onChange={(event) => {
                        const { value } = event.target;
                        if (isKnownLanguage(value)) {
                          form.changeOptions({ ...options, language: value });
                        }
                      }}
                    >
                      {LANGUAGES.map(({ id, label }) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <SegmentedControl
                  legend="Expires after"
                  name="expiry"
                  options={EXPIRY_SEGMENTS}
                  value={options.expiry}
                  onChange={(expiry) => {
                    form.changeOptions({ ...options, expiry });
                  }}
                  busy={form.busy}
                />
              </div>

              <RadioList
                legend="Views"
                name="views"
                options={viewsOptions}
                value={options.views}
                onChange={(views) => {
                  form.changeOptions({ ...options, views });
                }}
                error={form.viewCountProblem}
                errorId={viewCountErrorId}
                busy={form.busy}
              />
            </div>

            <ActionRow className={styles.submitRow}>
              <Button
                ref={submitRef}
                type="submit"
                variant="primary"
                size="lg"
                icon={LockIcon}
                className={styles.submit}
                busyLabel={form.busyLabel}
                reserveLabels={BUSY_LABELS}
                disabled={form.waiting}
                title={shortcutHint}
                aria-keyshortcuts={SUBMIT_KEY_SHORTCUTS}
                onPointerDown={form.pressSubmit}
              >
                {SUBMIT_LABEL}
              </Button>
            </ActionRow>
          </Panel>
        </form>
      </Panel>
    </>
  );
}
