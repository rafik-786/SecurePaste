export type ClassName = string | false | null | undefined;

export function cx(...names: readonly ClassName[]): string {
  return names.filter((name): name is string => typeof name === 'string' && name !== '').join(' ');
}
