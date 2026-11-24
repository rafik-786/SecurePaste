import { isRecord } from './guards';

export interface PastePayload {
  readonly content: string;
  readonly language: string;
}

export class InvalidPayloadError extends Error {
  override readonly name = 'InvalidPayloadError';
  readonly code = 'invalid-payload';
}

const encoder = new TextEncoder();
const strictDecoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

export function serializePayload(payload: PastePayload): Uint8Array<ArrayBuffer> {
  return encoder.encode(JSON.stringify({ content: payload.content, language: payload.language }));
}

export function payloadByteSize(payload: PastePayload): number {
  return serializePayload(payload).byteLength;
}

export function parsePayload(bytes: Uint8Array): PastePayload {
  let value: unknown;
  try {
    value = JSON.parse(strictDecoder.decode(bytes));
  } catch {
    // No cause: V8 quotes the start of the input in JSON syntax errors, and that is plaintext.
    throw new InvalidPayloadError('The payload is not UTF-8 encoded JSON.');
  }

  if (!isRecord(value) || typeof value.content !== 'string' || typeof value.language !== 'string') {
    throw new InvalidPayloadError('The payload needs a string content and a string language.');
  }

  return { content: value.content, language: value.language };
}
