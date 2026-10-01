import { describe, expect, it } from 'vitest';
import { deleteLink, deleteTarget, shareLink } from './links';

const ORIGIN = 'https://securepaste.app';
const ID = 'x7k2mn4pq9rs';
const KEY = 'xCCvY4XmaJj_jCT8M5S78fgy1X4fvzuxtYPqsh_N4Jw';
const DELETE_TOKEN = 'Xcmid5zrf-0Cn-W2Mh_yzNeCJTTY4bmz7jBr3lRgSnU';

describe('result links', () => {
  it('puts the key and the delete token after the #', () => {
    expect(shareLink(ORIGIN, ID, KEY)).toBe(
      'https://securepaste.app/p/x7k2mn4pq9rs#xCCvY4XmaJj_jCT8M5S78fgy1X4fvzuxtYPqsh_N4Jw',
    );
    expect(deleteLink(ORIGIN, ID, DELETE_TOKEN)).toBe(
      'https://securepaste.app/d/x7k2mn4pq9rs#Xcmid5zrf-0Cn-W2Mh_yzNeCJTTY4bmz7jBr3lRgSnU',
    );
  });

  it('reads the id and the token back out of a delete link', () => {
    expect(deleteTarget(deleteLink(ORIGIN, ID, DELETE_TOKEN))).toEqual({
      id: ID,
      deleteToken: DELETE_TOKEN,
    });
    expect(deleteTarget(deleteLink('http://localhost:3000', ID, DELETE_TOKEN))).toEqual({
      id: ID,
      deleteToken: DELETE_TOKEN,
    });
  });
});
