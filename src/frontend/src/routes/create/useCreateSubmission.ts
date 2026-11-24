import { useEffect, useRef, useState, type FocusEvent, type RefObject } from 'react';
import { createPaste } from '../../api/client';
import type { ApiError } from '../../api/errors';
import { requestFailure } from '../../api/request';
import type { CreatePasteResponse } from '../../api/types';
import { useCountdown, type Countdown } from '../../hooks/useCountdown';
import { measureEncryptedSize } from '../../hooks/useEncryptedSize';
import { useRequestSignal } from '../../hooks/useRequestSignal';
import { encryptPaste, PayloadTooLargeError, type EncryptedPaste } from '../../lib/crypto';
import {
  contentError,
  createRequest,
  maxViewsFor,
  overLimitError,
  viewCountError,
  type CreateOptions,
} from './formOptions';
import { createdPaste, type CreatedPaste } from './links';
import { useBlurValidation } from './useBlurValidation';

export const ENCRYPTING_LABEL = 'Encrypting...';
export const UPLOADING_LABEL = 'Uploading...';

export interface EncryptFailure {
  readonly kind: 'encrypt-failed';
}

export type CreateFailure = ApiError | EncryptFailure;

type Phase =
  | { readonly phase: 'idle' }
  | { readonly phase: 'encrypting' }
  | { readonly phase: 'uploading' }
  | { readonly phase: 'failed'; readonly failure: CreateFailure };

type FormField = 'content' | 'viewCount';

interface FocusRequest {
  readonly field: FormField;
}

const IDLE: Phase = { phase: 'idle' };

function busyLabelFor({ phase }: Phase): string | undefined {
  switch (phase) {
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

export interface CreateSubmissionProps {
  readonly contentRef: RefObject<HTMLTextAreaElement | null>;
  readonly viewCountRef: RefObject<HTMLInputElement | null>;
  readonly submitRef: RefObject<HTMLButtonElement | null>;
  readonly options: CreateOptions;
  readonly onOptionsChange: (options: CreateOptions) => void;
  readonly onCreated: (paste: CreatedPaste) => void;
}

export interface CreateSubmission {
  readonly content: string;
  readonly contentProblem: string | undefined;
  readonly viewCountProblem: string | undefined;
  readonly failure: CreateFailure | undefined;
  readonly countdown: Countdown;
  readonly busyLabel: string | undefined;
  readonly busy: boolean;
  readonly waiting: boolean;
  readonly changeContent: (content: string) => void;
  readonly changeOptions: (options: CreateOptions) => void;
  readonly changeViewCount: (viewCount: string) => void;
  readonly blurContent: (event: FocusEvent) => void;
  readonly blurViewCount: (event: FocusEvent) => void;
  readonly pressSubmit: () => void;
  readonly submit: () => void;
}

export function useCreateSubmission({
  contentRef,
  viewCountRef,
  submitRef,
  options,
  onOptionsChange,
  onCreated,
}: CreateSubmissionProps): CreateSubmission {
  const [content, setContent] = useState('');
  const [contentProblem, setContentProblem] = useState<string | undefined>(undefined);
  const [viewCountProblem, setViewCountProblem] = useState<string | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>(IDLE);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | undefined>(undefined);
  const edited = useRef({ content: false, viewCount: false });
  const inFlight = useRef(false);
  const requestSignal = useRequestSignal();
  const blur = useBlurValidation(submitRef);

  const failure = phase.phase === 'failed' ? phase.failure : undefined;
  const countdown = useCountdown(failure?.kind === 'rate-limited' ? failure : undefined);
  const waiting = !countdown.done;
  const busyLabel = busyLabelFor(phase);
  const busy = busyLabel !== undefined;

  useEffect(() => {
    if (focusRequest) {
      (focusRequest.field === 'content' ? contentRef : viewCountRef).current?.focus();
    }
  }, [focusRequest, contentRef, viewCountRef]);

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

  const blurContent = (event: FocusEvent) => {
    if (edited.current.content) {
      blur.validateOnBlur(event, () => {
        setContentProblem(checkContent(content, options.language));
      });
    }
  };

  const blurViewCount = (event: FocusEvent) => {
    if (edited.current.viewCount) {
      blur.validateOnBlur(event, () => {
        setViewCountProblem(viewCountError(options));
      });
    }
  };

  const validate = (): { readonly maxViews: number | null } | undefined => {
    const maxViews = maxViewsFor(options);
    const nextContentProblem = checkContent(content, options.language);
    setContentProblem(nextContentProblem);
    setViewCountProblem(viewCountError(options));
    if (nextContentProblem === undefined && maxViews !== undefined) {
      return { maxViews };
    }
    setPhase(IDLE);
    setFocusRequest({ field: nextContentProblem === undefined ? 'viewCount' : 'content' });
    return undefined;
  };

  const encrypt = async (): Promise<EncryptedPaste | undefined> => {
    setPhase({ phase: 'encrypting' });
    try {
      return await encryptPaste({ content, language: options.language });
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        setPhase(IDLE);
        setContentProblem(overLimitError(error.blobBytes));
        setFocusRequest({ field: 'content' });
      } else {
        setPhase({ phase: 'failed', failure: { kind: 'encrypt-failed' } });
      }
      return undefined;
    }
  };

  const upload = async (
    ciphertext: string,
    maxViews: number | null,
  ): Promise<CreatePasteResponse | undefined> => {
    setPhase({ phase: 'uploading' });
    try {
      return await createPaste(
        createRequest(ciphertext, options.expiry, maxViews),
        requestSignal(),
      );
    } catch (error) {
      const failed = requestFailure(error);
      if (failed) {
        setPhase({ phase: 'failed', failure: failed });
      }
      return undefined;
    }
  };

  const run = async () => {
    const valid = validate();
    if (!valid) {
      return;
    }
    inFlight.current = true;
    try {
      const encrypted = await encrypt();
      const created = encrypted && (await upload(encrypted.ciphertext, valid.maxViews));
      if (encrypted && created) {
        onCreated(createdPaste(window.location.origin, created, encrypted.key, valid.maxViews));
      }
    } finally {
      inFlight.current = false;
    }
  };

  const submit = () => {
    if (inFlight.current || waiting) {
      return;
    }
    blur.cancelPending();
    void run();
  };

  return {
    content,
    contentProblem,
    viewCountProblem,
    failure,
    countdown,
    busyLabel,
    busy,
    waiting,
    changeContent,
    changeOptions,
    changeViewCount,
    blurContent,
    blurViewCount,
    pressSubmit: blur.pressSubmit,
    submit,
  };
}
