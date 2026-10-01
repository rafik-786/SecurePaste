import { useEffect, useId, useRef, useState } from 'react';
import { createPaste } from '../../api/client';
import { ApiError } from '../../api/errors';
import { requestFailure } from '../../api/request';
import type { CreatePasteResponse } from '../../api/types';
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
import { useCountdown } from '../../hooks/useCountdown';
import { measureEncryptedSize, useEncryptedSize } from '../../hooks/useEncryptedSize';
import { useRequestSignal } from '../../hooks/useRequestSignal';
import { encryptPaste, PayloadTooLargeError, type EncryptedPaste } from '../../lib/crypto';
import { formatShortcut } from '../../lib/format';
import { isKnownLanguage, LANGUAGES } from '../../lib/languages';
import { EXPIRY_OPTIONS, MAX_VIEWS, MIN_VIEWS } from '../../lib/limits';
import { isApplePlatform, isSubmitShortcut, SUBMIT_KEY_SHORTCUTS } from '../../lib/platform';
import { parseInstant } from '../../lib/time';
import { CreateFailureAlert } from './CreateFailureAlert';
import {
  contentError,
  createRequest,
  maxViewsFor,
  overLimitError,
  viewCountError,
  type CreateOptions,
  type ViewsChoice,
} from './formOptions';
import { deleteLink, shareLink, type CreatedPaste } from './links';
import styles from './CreateForm.module.css';

const SUBMIT_LABEL = 'Encrypt and create link';
const ENCRYPTING_LABEL = 'Encrypting...';
const UPLOADING_LABEL = 'Uploading...';
const BUSY_LABELS = [ENCRYPTING_LABEL, UPLOADING_LABEL];

const EXPIRY_SEGMENTS = EXPIRY_OPTIONS.map(({ id, label }) => ({ value: id, label }));

type Submission =
  | { readonly phase: 'idle' }
  | { readonly phase: 'encrypting' }
  | { readonly phase: 'uploading' }
  | { readonly phase: 'failed'; readonly failure: ApiError };

const IDLE: Submission = { phase: 'idle' };

interface FocusRequest {
  readonly target: 'content' | 'viewCount';
}

function busyLabelFor(submission: Submission): string | undefined {
  switch (submission.phase) {
    case 'encrypting':
      return ENCRYPTING_LABEL;
    case 'uploading':
      return UPLOADING_LABEL;
    default:
      return undefined;
  }
}

function checkContent(content: string, language: string): string | undefined {
  return contentError(content, measureEncryptedSize(content, language));
}

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
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const viewCountRef = useRef<HTMLInputElement>(null);
  const meterId = useId();
  const viewCountErrorId = useId();
  const [content, setContent] = useState('');
  const [contentProblem, setContentProblem] = useState<string | undefined>(undefined);
  const [viewCountProblem, setViewCountProblem] = useState<string | undefined>(undefined);
  const [submission, setSubmission] = useState<Submission>(IDLE);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | undefined>(undefined);
  const edited = useRef({ content: false, viewCount: false });
  const inFlight = useRef(false);
  const requestSignal = useRequestSignal();
  const bytes = useEncryptedSize(content, options.language);

  const failure = submission.phase === 'failed' ? submission.failure : undefined;
  const countdown = useCountdown(failure?.kind === 'rate-limited' ? failure : undefined);
  const waiting = !countdown.done;
  const busyLabel = busyLabelFor(submission);
  const busy = busyLabel !== undefined;

  useEffect(() => {
    if (focusContentOnMount) {
      contentRef.current?.focus();
    }
  }, [focusContentOnMount]);

  useEffect(() => {
    if (focusRequest) {
      (focusRequest.target === 'content' ? contentRef : viewCountRef).current?.focus();
    }
  }, [focusRequest]);

  const changeOptions = (next: CreateOptions) => {
    if (busy) {
      return;
    }
    onOptionsChange(next);
    if (contentProblem !== undefined && next.language !== options.language) {
      setContentProblem(checkContent(content, next.language));
    }
    if (viewCountProblem !== undefined) {
      setViewCountProblem(viewCountError(next));
    }
  };

  const changeContent = (value: string) => {
    if (busy) {
      return;
    }
    edited.current.content = true;
    setContent(value);
    if (contentProblem !== undefined) {
      setContentProblem(checkContent(value, options.language));
    }
  };

  const changeViewCount = (viewCount: string) => {
    if (busy) {
      return;
    }
    edited.current.viewCount = true;
    changeOptions({ ...options, views: 'limit', viewCount });
  };

  const submit = async () => {
    if (inFlight.current || waiting) {
      return;
    }
    const maxViews = maxViewsFor(options);
    const nextContentProblem = checkContent(content, options.language);
    const nextViewCountProblem = viewCountError(options);
    setContentProblem(nextContentProblem);
    setViewCountProblem(nextViewCountProblem);
    if (nextContentProblem !== undefined || maxViews === undefined) {
      setSubmission(IDLE);
      setFocusRequest({ target: nextContentProblem === undefined ? 'viewCount' : 'content' });
      return;
    }

    inFlight.current = true;
    setSubmission({ phase: 'encrypting' });

    let encrypted: EncryptedPaste;
    try {
      encrypted = await encryptPaste({ content, language: options.language });
    } catch (error) {
      inFlight.current = false;
      if (error instanceof PayloadTooLargeError) {
        setSubmission(IDLE);
        setContentProblem(overLimitError(error.blobBytes));
        setFocusRequest({ target: 'content' });
      } else {
        setSubmission({ phase: 'failed', failure: new ApiError({ kind: 'unexpected' }) });
      }
      return;
    }

    setSubmission({ phase: 'uploading' });
    let created: CreatePasteResponse;
    try {
      created = await createPaste(
        createRequest(encrypted.ciphertext, options.expiry, maxViews),
        requestSignal(),
      );
    } catch (error) {
      inFlight.current = false;
      const failed = requestFailure(error);
      if (failed) {
        setSubmission({ phase: 'failed', failure: failed });
      }
      return;
    }

    inFlight.current = false;
    const { origin } = window.location;
    onCreated({
      shareLink: shareLink(origin, created.id, encrypted.key),
      deleteLink: deleteLink(origin, created.id, created.deleteToken),
      expiresAt: parseInstant(created.expiresAt),
      maxViews,
    });
  };

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
            aria-invalid={viewCountProblem !== undefined || undefined}
            aria-describedby={viewCountProblem === undefined ? undefined : viewCountErrorId}
            // Out of the tab order until Limit is chosen: focusing it selects Limit, so tabbing
            // past it would silently swap burn after reading for five views.
            tabIndex={options.views === 'limit' ? undefined : -1}
            readOnly={busy}
            value={options.viewCount}
            min={MIN_VIEWS}
            max={MAX_VIEWS}
            onValueChange={changeViewCount}
            onActivate={() => {
              if (options.views !== 'limit') {
                changeOptions({ ...options, views: 'limit' });
              }
            }}
            onBlur={() => {
              if (edited.current.viewCount) {
                setViewCountProblem(viewCountError(options));
              }
            }}
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
          void submit();
        }}
        onKeyDown={(event) => {
          if (isSubmitShortcut(event)) {
            event.preventDefault();
            void submit();
          }
        }}
      >
        <Field label="Content" error={contentProblem} describedBy={meterId}>
          {(control) => (
            <>
              <TextArea
                {...control}
                ref={contentRef}
                value={content}
                placeholder="Paste text or code here"
                readOnly={busy}
                onChange={(event) => {
                  changeContent(event.target.value);
                }}
                onBlur={() => {
                  if (edited.current.content) {
                    setContentProblem(checkContent(content, options.language));
                  }
                }}
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
                    changeOptions({ ...options, language: value });
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
              changeOptions({ ...options, expiry });
            }}
            hint="Removed from the server at this time, even if nobody opened it."
            busy={busy}
          />
        </div>

        <RadioList
          legend="Views"
          name="views"
          options={viewsOptions}
          value={options.views}
          onChange={(views) => {
            changeOptions({ ...options, views });
          }}
          error={viewCountProblem}
          errorId={viewCountErrorId}
          busy={busy}
        />

        {failure && <CreateFailureAlert failure={failure} countdown={countdown} />}

        <ActionRow>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            icon={LockIcon}
            busyLabel={busyLabel}
            reserveLabels={BUSY_LABELS}
            disabled={waiting}
            aria-keyshortcuts={SUBMIT_KEY_SHORTCUTS}
          >
            {SUBMIT_LABEL}
          </Button>
          <Kbd className={styles.shortcut}>{formatShortcut('Enter', isApplePlatform())}</Kbd>
        </ActionRow>
      </form>
    </>
  );
}
