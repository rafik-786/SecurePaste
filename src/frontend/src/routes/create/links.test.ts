import { describe, expect, it } from 'vitest';
import { createdPaste, deleteLink, shareLink } from './links';

const ORIGIN = 'https://securepaste.app';
const ID = 'x7k2mn4pq9rs';
const KEY = 'xCCvY4XmaJj_jCT8M5S78fgy1X4fvzuxtYPqsh_N4Jw';
const DELETE_TOKEN = 'Xcmid5zrf-0Cn-W2Mh_yzNeCJTTY4bmz7jBr3lRgSnU';
const EXPIRES_AT = '2026-08-04T18:32:00.1234567+00:00';

describe('result links', () => {
  it('puts the key and the delete token after the #', () => {
    expect(shareLink(ORIGIN, ID, KEY)).toBe(
      'https://securepaste.app/p/x7k2mn4pq9rs#xCCvY4XmaJj_jCT8M5S78fgy1X4fvzuxtYPqsh_N4Jw',
    );
    expect(deleteLink(ORIGIN, ID, DELETE_TOKEN)).toBe(
      'https://securepaste.app/d/x7k2mn4pq9rs#Xcmid5zrf-0Cn-W2Mh_yzNeCJTTY4bmz7jBr3lRgSnU',
    );
  });

  it('keeps the id and the token exactly as the server sent them, beside the links', () => {
    const response = { id: ID, deleteToken: DELETE_TOKEN, expiresAt: EXPIRES_AT };

    expect(createdPaste('http://localhost:3000', response, KEY, 5)).toEqual({
      id: ID,
      deleteToken: DELETE_TOKEN,
      shareLink: `http://localhost:3000/p/${ID}#${KEY}`,
      deleteLink: `http://localhost:3000/d/${ID}#${DELETE_TOKEN}`,
      expiresAt: new Date('2026-08-04T18:32:00.123Z'),
      maxViews: 5,
    });
  });
});
