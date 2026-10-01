const STANDARD_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const PADDING = '=';
const BYTES_PER_BLOCK = 3;
const CHARS_PER_BLOCK = 4;
const ASCII_LIMIT = 128;
const NOT_IN_ALPHABET = -1;

export class InvalidBase64Error extends Error {
  override readonly name = 'InvalidBase64Error';
  readonly code = 'invalid-base64';
}

interface Codec {
  readonly encodeTable: Uint8Array;
  readonly decodeTable: Int8Array;
}

function createCodec(alphabet: string): Codec {
  const encodeTable = new Uint8Array(alphabet.length);
  const decodeTable = new Int8Array(ASCII_LIMIT).fill(NOT_IN_ALPHABET);
  for (let value = 0; value < alphabet.length; value++) {
    const code = alphabet.charCodeAt(value);
    encodeTable[value] = code;
    decodeTable[code] = value;
  }
  return { encodeTable, decodeTable };
}

const STANDARD = createCodec(STANDARD_ALPHABET);
const URL_SAFE = createCodec(URL_ALPHABET);
const PADDING_CODE = PADDING.charCodeAt(0);
const asciiDecoder = new TextDecoder();

function encode(bytes: Uint8Array, { encodeTable }: Codec, padded: boolean): string {
  const fullBlockBytes = bytes.length - (bytes.length % BYTES_PER_BLOCK);
  const tailBytes = bytes.length - fullBlockBytes;
  const tailChars = tailBytes === 0 ? 0 : padded ? CHARS_PER_BLOCK : tailBytes + 1;
  const chars = new Uint8Array((fullBlockBytes / BYTES_PER_BLOCK) * CHARS_PER_BLOCK + tailChars);
  const char = (sextet: number) => encodeTable[sextet & 0x3f] ?? 0;

  let out = 0;
  for (let i = 0; i < fullBlockBytes; i += BYTES_PER_BLOCK) {
    const block = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    chars[out++] = char(block >> 18);
    chars[out++] = char(block >> 12);
    chars[out++] = char(block >> 6);
    chars[out++] = char(block);
  }

  if (tailBytes > 0) {
    const block = ((bytes[fullBlockBytes] ?? 0) << 16) | ((bytes[fullBlockBytes + 1] ?? 0) << 8);
    chars[out++] = char(block >> 18);
    chars[out++] = char(block >> 12);
    if (tailBytes === 2) {
      chars[out++] = char(block >> 6);
    }
    if (padded) {
      chars.fill(PADDING_CODE, out);
    }
  }

  return asciiDecoder.decode(chars);
}

function decodeUnpadded(text: string, { decodeTable }: Codec): Uint8Array<ArrayBuffer> {
  const tailChars = text.length % CHARS_PER_BLOCK;
  if (tailChars === 1) {
    throw new InvalidBase64Error(`A base64 text of ${text.length} characters is impossible.`);
  }

  const sextet = (index: number): number => {
    const code = text.charCodeAt(index);
    const value = code < ASCII_LIMIT ? (decodeTable[code] ?? NOT_IN_ALPHABET) : NOT_IN_ALPHABET;
    if (value === NOT_IN_ALPHABET) {
      throw new InvalidBase64Error(`Unexpected character at position ${index}.`);
    }
    return value;
  };

  const fullBlockChars = text.length - tailChars;
  const tailBytes = tailChars === 0 ? 0 : tailChars - 1;
  const bytes = new Uint8Array((fullBlockChars / CHARS_PER_BLOCK) * BYTES_PER_BLOCK + tailBytes);

  let out = 0;
  for (let i = 0; i < fullBlockChars; i += CHARS_PER_BLOCK) {
    const block = (sextet(i) << 18) | (sextet(i + 1) << 12) | (sextet(i + 2) << 6) | sextet(i + 3);
    bytes[out++] = block >> 16;
    bytes[out++] = (block >> 8) & 0xff;
    bytes[out++] = block & 0xff;
  }

  if (tailChars > 0) {
    const first = sextet(fullBlockChars);
    const second = sextet(fullBlockChars + 1);
    const third = tailChars === 3 ? sextet(fullBlockChars + 2) : 0;
    const unusedBits = tailChars === 3 ? third & 0x03 : second & 0x0f;
    if (unusedBits !== 0) {
      throw new InvalidBase64Error('The final character carries bits past the end of the data.');
    }
    bytes[out++] = (first << 2) | (second >> 4);
    if (tailChars === 3) {
      bytes[out] = ((second & 0x0f) << 4) | (third >> 2);
    }
  }

  return bytes;
}

export function encodeBase64(bytes: Uint8Array): string {
  return encode(bytes, STANDARD, true);
}

export function decodeBase64(text: string): Uint8Array<ArrayBuffer> {
  if (text.length % CHARS_PER_BLOCK !== 0) {
    throw new InvalidBase64Error('Padded base64 must be a whole number of 4-character blocks.');
  }
  const padding = text.endsWith(PADDING.repeat(2)) ? 2 : text.endsWith(PADDING) ? 1 : 0;
  return decodeUnpadded(text.slice(0, text.length - padding), STANDARD);
}

export function encodeBase64Url(bytes: Uint8Array): string {
  return encode(bytes, URL_SAFE, false);
}

export function decodeBase64Url(text: string): Uint8Array<ArrayBuffer> {
  return decodeUnpadded(text, URL_SAFE);
}
