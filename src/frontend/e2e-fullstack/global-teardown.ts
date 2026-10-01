import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { FullConfig } from '@playwright/test';
import { emptyLedger, isLedger, LEDGER_FILE_PREFIX, type ApiLedger } from './ledger';

const CREATES_PER_MINUTE = 20;
const CLAIMS_PER_MINUTE = 60;

async function readLedgers(outputDir: string): Promise<ApiLedger[]> {
  let names: string[];
  try {
    names = await readdir(outputDir);
  } catch {
    return [];
  }
  const ledgers: ApiLedger[] = [];
  for (const name of names.filter((file) => file.startsWith(LEDGER_FILE_PREFIX))) {
    const parsed: unknown = JSON.parse(await readFile(path.join(outputDir, name), 'utf8'));
    if (isLedger(parsed)) {
      ledgers.push(parsed);
    }
  }
  return ledgers;
}

export default async function globalTeardown(config: FullConfig): Promise<void> {
  const outputDir = config.projects[0]?.outputDir;
  if (outputDir === undefined) {
    return;
  }
  const total = (await readLedgers(outputDir)).reduce<ApiLedger>(
    (sum, ledger) => ({
      creates: sum.creates + ledger.creates,
      claims: sum.claims + ledger.claims,
      peeks: sum.peeks + ledger.peeks,
      deletes: sum.deletes + ledger.deletes,
    }),
    emptyLedger(),
  );

  console.log(
    `Full-stack API use: ${total.creates} creates (limit ${CREATES_PER_MINUTE} per minute), ` +
      `${total.claims} claims (limit ${CLAIMS_PER_MINUTE} per minute), ` +
      `${total.peeks} peeks, ${total.deletes} deletes.`,
  );
  if (total.creates > CREATES_PER_MINUTE || total.claims > CLAIMS_PER_MINUTE) {
    throw new Error('The full-stack suite outgrew the API rate limits; split it or slow it down.');
  }
}
