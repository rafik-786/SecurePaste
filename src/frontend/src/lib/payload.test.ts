import { describe, expect, it } from 'vitest';
import {
  InvalidPayloadError,
  parsePayload,
  payloadByteSize,
  serializePayload,
  type PastePayload,
} from './payload';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const PAYLOADS: readonly { name: string; payload: PastePayload }[] = [
  { name: 'ASCII', payload: { content: 'DB_PASSWORD=hunter2', language: 'bash' } },
  { name: 'empty content', payload: { content: '', language: 'plaintext' } },
  { name: 'CRLF line endings', payload: { content: 'line one\r\nline two\r\n', language: 'diff' } },
  { name: 'tabs and quotes', payload: { content: '\t"quoted" \\ back\\slash', language: 'json' } },
  { name: 'control characters', payload: { content: '\u0000\u0001\u001f\u007f', language: 'c' } },
  { name: 'two-byte characters', payload: { content: 'Привет, мир', language: 'plaintext' } },
  { name: 'three-byte characters', payload: { content: 'こんにちは世界', language: 'plaintext' } },
  { name: 'emoji', payload: { content: '🔐 secrets 👩‍💻', language: 'markdown' } },
  { name: 'a lone surrogate', payload: { content: 'broken \ud800 pair', language: 'plaintext' } },
  { name: 'line separators', payload: { content: 'a b c', language: 'javascript' } },
];

describe('serializePayload', () => {
  it('writes UTF-8 JSON with content first and language second', () => {
    const bytes = serializePayload({ content: 'DB_PASSWORD=hunter2', language: 'bash' });

    expect(decoder.decode(bytes)).toBe('{"content":"DB_PASSWORD=hunter2","language":"bash"}');
  });

  it('drops properties that are not part of the payload', () => {
    const withExtras = { content: 'x', language: 'go', deleteToken: 'must-not-leak' };

    expect(decoder.decode(serializePayload(withExtras))).toBe('{"content":"x","language":"go"}');
  });
});

describe('payloadByteSize', () => {
  it.each(PAYLOADS)('equals the serialized length for $name', ({ payload }) => {
    expect(payloadByteSize(payload)).toBe(serializePayload(payload).byteLength);
  });

  it('counts multi-byte characters by their UTF-8 width', () => {
    const overhead = payloadByteSize({ content: '', language: 'plaintext' });

    expect(payloadByteSize({ content: 'é', language: 'plaintext' })).toBe(overhead + 2);
    expect(payloadByteSize({ content: '€', language: 'plaintext' })).toBe(overhead + 3);
    expect(payloadByteSize({ content: '🔐', language: 'plaintext' })).toBe(overhead + 4);
  });

  it('counts JSON escapes', () => {
    const overhead = payloadByteSize({ content: '', language: 'plaintext' });

    expect(payloadByteSize({ content: '"\n', language: 'plaintext' })).toBe(overhead + 4);
  });
});

describe('parsePayload', () => {
  it.each(PAYLOADS)('round-trips $name exactly', ({ payload }) => {
    expect(parsePayload(serializePayload(payload))).toEqual(payload);
  });

  it('keeps only content and language when a newer client added fields', () => {
    const bytes = encoder.encode('{"content":"x","language":"go","title":"later"}');

    expect(parsePayload(bytes)).toEqual({ content: 'x', language: 'go' });
  });

  it.each([
    { name: 'invalid UTF-8', bytes: Uint8Array.of(0x7b, 0xff, 0x7d) },
    { name: 'a byte order mark', bytes: encoder.encode('﻿{"content":"x","language":"go"}') },
    { name: 'text that is not JSON', bytes: encoder.encode('hello') },
    { name: 'an empty body', bytes: new Uint8Array(0) },
    { name: 'JSON null', bytes: encoder.encode('null') },
    { name: 'a JSON array', bytes: encoder.encode('["x","go"]') },
    { name: 'a JSON string', bytes: encoder.encode('"x"') },
    { name: 'missing content', bytes: encoder.encode('{"language":"go"}') },
    { name: 'missing language', bytes: encoder.encode('{"content":"x"}') },
    { name: 'numeric content', bytes: encoder.encode('{"content":1,"language":"go"}') },
    { name: 'null language', bytes: encoder.encode('{"content":"x","language":null}') },
  ])('rejects $name', ({ bytes }) => {
    expect(() => parsePayload(bytes)).toThrow(InvalidPayloadError);
  });

  it('reports a stable error code', () => {
    expect(() => parsePayload(encoder.encode('[]'))).toThrow(
      expect.objectContaining({ name: 'InvalidPayloadError', code: 'invalid-payload' }),
    );
  });
});
