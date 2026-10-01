const FRAGMENT_LENGTH = 4;

export function errorChainMessages(error: unknown): string {
  const messages: string[] = [];
  const seen = new Set<unknown>();
  let current = error;
  while (current !== undefined && current !== null && !seen.has(current)) {
    seen.add(current);
    if (!(current instanceof Error)) {
      messages.push(typeof current === 'string' ? current : JSON.stringify(current));
      break;
    }
    messages.push(current.message);
    current = current.cause;
  }
  return messages.join('\n');
}

export function leakedFragments(text: string, plaintext: string): string[] {
  const leaked = new Set<string>();
  for (let start = 0; start + FRAGMENT_LENGTH <= plaintext.length; start++) {
    const fragment = plaintext.slice(start, start + FRAGMENT_LENGTH);
    if (text.includes(fragment)) {
      leaked.add(fragment);
    }
  }
  return [...leaked];
}
