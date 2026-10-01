import { isRecord } from '../lib/guards';

export type ApiErrorKind =
  | 'validation'
  | 'not-found'
  | 'gone'
  | 'forbidden'
  | 'too-large'
  | 'rate-limited'
  | 'network'
  | 'unexpected';

export const PROBLEM_TYPE_BASE = 'https://securepaste.app/problems/';

const KIND_BY_PROBLEM_TYPE: ReadonlyMap<string, ApiErrorKind> = new Map([
  [`${PROBLEM_TYPE_BASE}validation`, 'validation'],
  [`${PROBLEM_TYPE_BASE}paste-not-found`, 'not-found'],
  [`${PROBLEM_TYPE_BASE}paste-gone`, 'gone'],
  [`${PROBLEM_TYPE_BASE}invalid-delete-token`, 'forbidden'],
  [`${PROBLEM_TYPE_BASE}payload-too-large`, 'too-large'],
  [`${PROBLEM_TYPE_BASE}rate-limited`, 'rate-limited'],
]);

const KIND_BY_STATUS: ReadonlyMap<number, ApiErrorKind> = new Map([
  [400, 'validation'],
  [403, 'forbidden'],
  [404, 'not-found'],
  [410, 'gone'],
  [413, 'too-large'],
  [429, 'rate-limited'],
]);

const RETRY_AFTER_HEADER = 'Retry-After';
const DELAY_SECONDS_PATTERN = /^\d+$/;
const HTTP_DATE_PATTERN = /^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/;

export interface ApiErrorInit {
  readonly kind: ApiErrorKind;
  readonly status?: number | undefined;
  readonly retryAfterSeconds?: number | undefined;
  readonly detail?: string | undefined;
  readonly cause?: unknown;
}

export class ApiError extends Error {
  override readonly name = 'ApiError';
  readonly kind: ApiErrorKind;
  readonly status: number | undefined;
  readonly retryAfterSeconds: number | undefined;
  readonly detail: string | undefined;

  constructor(init: ApiErrorInit) {
    const summary = init.status === undefined ? init.kind : `${init.kind} (HTTP ${init.status})`;
    super(
      init.detail === undefined ? summary : `${summary}: ${init.detail}`,
      init.cause === undefined ? undefined : { cause: init.cause },
    );
    this.kind = init.kind;
    this.status = init.status;
    this.retryAfterSeconds = init.retryAfterSeconds;
    this.detail = init.detail;
  }
}

interface Problem {
  readonly type: string | undefined;
  readonly detail: string | undefined;
}

function readProblem(body: string): Problem | undefined {
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return undefined;
  }
  if (!isRecord(value)) {
    return undefined;
  }
  return {
    type: typeof value.type === 'string' ? value.type : undefined,
    detail: typeof value.detail === 'string' ? value.detail : undefined,
  };
}

export function parseRetryAfter(header: string | null, now: number): number | undefined {
  if (header === null) {
    return undefined;
  }
  const value = header.trim();
  if (DELAY_SECONDS_PATTERN.test(value)) {
    return Number(value);
  }
  if (!HTTP_DATE_PATTERN.test(value)) {
    return undefined;
  }
  const retryAt = Date.parse(value);
  return Number.isNaN(retryAt) ? undefined : Math.max(0, Math.ceil((retryAt - now) / 1000));
}

export async function errorFromResponse(response: Response, now = Date.now()): Promise<ApiError> {
  const problem = readProblem(await response.text());
  const kindFromType =
    problem?.type === undefined ? undefined : KIND_BY_PROBLEM_TYPE.get(problem.type);

  return new ApiError({
    kind: kindFromType ?? KIND_BY_STATUS.get(response.status) ?? 'unexpected',
    status: response.status,
    retryAfterSeconds: parseRetryAfter(response.headers.get(RETRY_AFTER_HEADER), now),
    detail: problem?.detail,
  });
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
