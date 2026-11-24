const WHOLE_NUMBER = /^\d+$/;

export function parseWholeNumber(text: string): number | undefined {
  const trimmed = text.trim();
  return WHOLE_NUMBER.test(trimmed) ? Number(trimmed) : undefined;
}

export function parseWholeNumberInRange(
  text: string,
  min: number,
  max: number,
): number | undefined {
  const value = parseWholeNumber(text);
  return value !== undefined && value >= min && value <= max ? value : undefined;
}
