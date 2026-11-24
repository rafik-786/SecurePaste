export function joinIds(
  ...ids: readonly (string | false | null | undefined)[]
): string | undefined {
  const joined = ids.filter((id) => typeof id === 'string' && id !== '').join(' ');
  return joined === '' ? undefined : joined;
}
