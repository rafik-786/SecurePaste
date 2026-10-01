import { useEffect, useId, useRef } from 'react';
import { ActionRow } from '../../components/ActionRow';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { LockIcon } from '../../components/icons/icons';
import { Kbd } from '../../components/Kbd';
import { NumberInput } from '../../components/NumberInput';
import { RadioList, type RadioOption } from '../../components/RadioList';
import { SegmentedControl } from '../../components/SegmentedControl';
import { Select } from '../../components/Select';
import { SizeMeter } from '../../components/SizeMeter';
import { TextArea } from '../../components/TextArea';
import { useEncryptedSize } from '../../hooks/useEncryptedSize';
import { formatShortcut } from '../../lib/format';
import { isKnownLanguage, LANGUAGES } from '../../lib/languages';
import { EXPIRY_OPTIONS, MAX_VIEWS, MIN_VIEWS } from '../../lib/limits';
import { isApplePlatform, isSubmitShortcut, SUBMIT_KEY_SHORTCUTS } from '../../lib/platform';
import { CreateFailureAlert } from './CreateFailureAlert';
import type { CreateOptions, ViewsChoice } from './formOptions';
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

  useEffect(() => {
    if (focusContentOnMount) {
      contentRef.current?.focus();
    }
  }, [focusContentOnMount, contentRef]);

  const viewsOptions: readonly RadioOption<ViewsChoice>[] = [
    { value: 'burn', label: 'Burn after reading', hint: 'Destroyed after the first view.' },
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
          views
        </>
      ),
      hint: 'Destroyed after the last view.',
    },
    {
      value: 'unlimited',
      label: 'Unlimited',
      hint: 'Anyone with the link can open it until it expires.',
    },
  ];

  return (
    <>
      <p className={styles.lead}>
        Encrypted in your browser before upload. The server stores only ciphertext and never sees
        the key.
      </p>
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
        <Field label="Content" error={form.contentProblem} describedBy={meterId}>
          {(control) => (
            <>
              <TextArea
                {...control}
                ref={contentRef}
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

        <div className={styles.options}>
          <Field
            label="Language"
            hint="Used for syntax highlighting. Stored inside the encrypted paste."
          >
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
            hint="Removed from the server at this time, even if nobody opened it."
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

        {form.failure && <CreateFailureAlert failure={form.failure} countdown={form.countdown} />}

        <ActionRow>
          <Button
            ref={submitRef}
            type="submit"
            variant="primary"
            size="lg"
            icon={LockIcon}
            busyLabel={form.busyLabel}
            reserveLabels={BUSY_LABELS}
            disabled={form.waiting}
            aria-keyshortcuts={SUBMIT_KEY_SHORTCUTS}
            onPointerDown={form.pressSubmit}
          >
            {SUBMIT_LABEL}
          </Button>
          <Kbd className={styles.shortcut}>{formatShortcut('Enter', isApplePlatform())}</Kbd>
        </ActionRow>
      </form>
    </>
  );
}
