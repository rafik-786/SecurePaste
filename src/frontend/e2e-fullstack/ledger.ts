export const LEDGER_FILE_PREFIX = 'api-ledger-';
export const CREATE_PATH = '/api/v1/pastes';

const CLAIM_PATH = /^\/api\/v1\/pastes\/[^/]+\/views$/;
const PASTE_PATH = /^\/api\/v1\/pastes\/[^/]+$/;

export interface ApiLedger {
  creates: number;
  claims: number;
  peeks: number;
  deletes: number;
}

export interface ApiCall {
  readonly method: string;
  readonly path: string;
}

export function emptyLedger(): ApiLedger {
  return { creates: 0, claims: 0, peeks: 0, deletes: 0 };
}

export function record(ledger: ApiLedger, { method, path }: ApiCall): void {
  if (method === 'POST' && path === CREATE_PATH) {
    ledger.creates += 1;
  } else if (method === 'POST' && CLAIM_PATH.test(path)) {
    ledger.claims += 1;
  } else if (method === 'GET' && PASTE_PATH.test(path)) {
    ledger.peeks += 1;
  } else if (method === 'DELETE' && PASTE_PATH.test(path)) {
    ledger.deletes += 1;
  }
}

export function isLedger(value: unknown): value is ApiLedger {
  return (
    typeof value === 'object' &&
    value !== null &&
    ['creates', 'claims', 'peeks', 'deletes'].every(
      (field) => typeof Reflect.get(value, field) === 'number',
    )
  );
}
