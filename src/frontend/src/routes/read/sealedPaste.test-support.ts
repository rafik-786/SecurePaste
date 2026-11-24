import { decodeBase64, encodeBase64, encodeBase64Url } from '../../lib/base64';
import { encryptPaste } from '../../lib/crypto';
import { IV_BYTES } from '../../lib/limits';

export interface SealedPaste {
  readonly ciphertext: string;
  readonly key: string;
  readonly sizeBytes: number;
}

export async function sealPaste(content: string, language: string): Promise<SealedPaste> {
  const { ciphertext, key } = await encryptPaste({ content, language });
  return { ciphertext, key, sizeBytes: decodeBase64(ciphertext).byteLength };
}

export async function sealRawPayload(json: string): Promise<SealedPaste> {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(json)),
  );
  const blob = new Uint8Array(IV_BYTES + sealed.byteLength);
  blob.set(iv);
  blob.set(sealed, IV_BYTES);
  const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', key));
  return { ciphertext: encodeBase64(blob), key: encodeBase64Url(rawKey), sizeBytes: blob.length };
}

export function tamper(ciphertext: string): string {
  const blob = decodeBase64(ciphertext);
  const last = blob.length - 1;
  blob[last] = (blob[last] ?? 0) ^ 0x01;
  return encodeBase64(blob);
}
