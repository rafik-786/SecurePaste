import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { constants, gzipSync } from 'node:zlib';

const KB = 1_024;
const BUDGET_KB = {
  route: 105,
  highlightCore: 10,
  grammar: 5,
  css: 15,
  firstLoadFonts: 93,
};
const FONT_PRELOAD = /<link rel="preload" href="\/([^"]+)" as="font"/g;
const CSS_FILE = /\.css$/i;
const HIGHLIGHT_CORE = /node_modules\/highlight\.js\/(es|lib)\/core\.js$/;
const GRAMMAR = /node_modules\/highlight\.js\/(es|lib)\/languages\/([\w-]+)\.js$/;
const ENTRY = 'index.html';
const CREATE_ROUTE = 'src/routes/create/CreateRoute.tsx';
const READ_ROUTE = 'src/routes/read/ReadRoute.tsx';

const distDir = path.resolve(import.meta.dirname, '..', process.argv[2] ?? 'dist');

async function listFiles(directory) {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(distDir, path.join(entry.parentPath, entry.name)));
}

async function gzippedBytes(file) {
  const bytes = await readFile(path.join(distDir, file));
  return gzipSync(bytes, { level: constants.Z_BEST_COMPRESSION }).length;
}

async function totalGzipped(files) {
  const sizes = await Promise.all(files.map(gzippedBytes));
  return sizes.reduce((sum, size) => sum + size, 0);
}

async function totalRaw(files) {
  const sizes = await Promise.all(
    files.map(async (file) => (await readFile(path.join(distDir, file))).length),
  );
  return sizes.reduce((sum, size) => sum + size, 0);
}

async function preloadedFonts() {
  const html = await readFile(path.join(distDir, ENTRY), 'utf8');
  const files = [...html.matchAll(FONT_PRELOAD)].map(([, file]) => file);
  if (files.length === 0) {
    throw new Error(`${ENTRY} preloads no fonts. Did the build plugin stop injecting them?`);
  }
  return files;
}

function staticClosure(manifest, keys) {
  const files = new Set();
  const visit = (key) => {
    const chunk = manifest[key];
    if (chunk === undefined) {
      throw new Error(`The build manifest has no "${key}". Did a route or the entry move?`);
    }
    if (files.has(chunk.file)) {
      return;
    }
    files.add(chunk.file);
    for (const imported of chunk.imports ?? []) {
      visit(imported);
    }
  };
  keys.forEach(visit);
  return [...files];
}

function kilobytes(bytes) {
  return `${(bytes / KB).toFixed(1)} KB`;
}

function row(item, files, bytes, budgetKb) {
  return {
    item,
    files: files.map((file) => path.basename(file)).join(' + '),
    size: `${kilobytes(bytes)} (${bytes.toLocaleString('en')} bytes)`,
    budget: `${budgetKb.toFixed(1)} KB`,
    ok: bytes <= budgetKb * KB,
  };
}

async function measure() {
  const manifestPath = path.join(distDir, '.vite', 'manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch {
    throw new Error(`No build manifest at ${manifestPath}. Run the build first.`);
  }
  const keys = Object.keys(manifest);
  const coreKey = keys.find((key) => HIGHLIGHT_CORE.test(key));
  const grammarKeys = keys.filter((key) => GRAMMAR.test(key));
  if (coreKey === undefined || grammarKeys.length === 0) {
    throw new Error('The build manifest has no highlight.js core or grammar chunks.');
  }
  const files = await listFiles(distDir);
  const cssFiles = files.filter((file) => CSS_FILE.test(file));
  const fontFiles = await preloadedFonts();

  const createFiles = staticClosure(manifest, [ENTRY, CREATE_ROUTE]);
  const readFiles = staticClosure(manifest, [ENTRY, READ_ROUTE]);
  const coreFile = manifest[coreKey].file;
  const grammars = await Promise.all(
    grammarKeys.map(async (key) => ({
      name: GRAMMAR.exec(key)[2],
      file: manifest[key].file,
      bytes: await gzippedBytes(manifest[key].file),
    })),
  );
  grammars.sort((a, b) => b.bytes - a.bytes);
  const [largest] = grammars;

  const rows = [
    row(
      '"/" interactive (entry + runtime + create)',
      createFiles,
      await totalGzipped(createFiles),
      BUDGET_KB.route,
    ),
    row(
      '"/p" interstitial (entry + runtime + read)',
      readFiles,
      await totalGzipped(readFiles),
      BUDGET_KB.route,
    ),
    row('highlight.js core', [coreFile], await gzippedBytes(coreFile), BUDGET_KB.highlightCore),
    row(
      `largest of ${grammars.length} grammars (${largest.name})`,
      [largest.file],
      largest.bytes,
      BUDGET_KB.grammar,
    ),
    ...grammars
      .slice(1)
      .filter(({ bytes }) => bytes > BUDGET_KB.grammar * KB)
      .map(({ name, file, bytes }) => row(`grammar ${name}`, [file], bytes, BUDGET_KB.grammar)),
    row('all CSS', cssFiles, await totalGzipped(cssFiles), BUDGET_KB.css),
    row(
      'fonts preloaded for "/" (woff2, sent as is)',
      fontFiles,
      await totalRaw(fontFiles),
      BUDGET_KB.firstLoadFonts,
    ),
  ];
  return rows;
}

function printTable(rows) {
  const header = {
    item: 'Budget item',
    size: 'Size',
    budget: 'Limit',
    status: 'Result',
    files: 'Files',
  };
  const lines = [header, ...rows.map((r) => ({ ...r, status: r.ok ? 'ok' : 'OVER' }))];
  const width = (field) => Math.max(...lines.map((line) => line[field].length));
  const columns = ['item', 'size', 'budget', 'status', 'files'];
  const format = (line) =>
    columns
      .map((field, index) =>
        index === columns.length - 1 ? line[field] : line[field].padEnd(width(field)),
      )
      .join(' | ');
  console.log(format(lines[0]));
  console.log(columns.map((field) => '-'.repeat(field === 'files' ? 5 : width(field))).join('-|-'));
  lines.slice(1).forEach((line) => console.log(format(line)));
}

try {
  const rows = await measure();
  console.log(
    `Bundle budget from ${path.relative(process.cwd(), distDir) || '.'}, gzip level 9; fonts are already compressed and counted as sent:\n`,
  );
  printTable(rows);
  const over = rows.filter(({ ok }) => !ok);
  if (over.length > 0) {
    console.error(`\nBundle budget exceeded: ${over.map(({ item }) => item).join('; ')}.`);
    process.exitCode = 1;
  } else {
    console.log('\nEvery budget holds.');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
