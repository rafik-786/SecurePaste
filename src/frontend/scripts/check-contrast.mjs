import { readFile } from 'node:fs/promises';
import path from 'node:path';

const TOKENS_FILE = path.resolve(import.meta.dirname, '..', 'src', 'styles', 'tokens.css');
const THEMES = {
  dark: ':root {',
  light: ":root[data-theme='light'] {",
};
const FALLBACK = '@supports not';
const GLOWS = ['glow-warm', 'glow-rose', 'glow-cool'];
const TEXT = 4.5;
const GRAPHIC = 3;

function tint(token) {
  return { tint: token };
}

// Each surface lists the layers painted over the backdrop, bottom first, exactly as the components
// stack them. A tint is the opaque tint token at --glass-tint opacity.
const SURFACES = {
  page: [],
  glass: ['glass-bg'],
  control: ['glass-bg', 'glass-bg-strong'],
  'hovered control': ['glass-bg', 'glass-bg-hover'],
  code: ['glass-bg', 'glass-code-bg'],
  'sealed strip': ['glass-bg', tint('color-accent-tint')],
  'opened strip': ['glass-bg', tint('color-surface-sunken')],
  'delete link box': ['glass-bg', tint('color-surface-sunken')],
  'control in the delete link box': ['glass-bg', tint('color-surface-sunken'), 'glass-bg-strong'],
  'hovered control in the delete link box': [
    'glass-bg',
    tint('color-surface-sunken'),
    'glass-bg-hover',
  ],
  'destroyed strip': ['glass-bg', tint('color-danger-tint')],
  'expired strip': ['glass-bg', tint('color-warning-tint')],
  'selected segment': ['glass-bg', 'glass-bg-strong', tint('color-accent-tint')],
  'info alert': ['glass-bg', tint('color-info-tint')],
  'info alert in a panel': ['glass-bg', 'glass-bg', tint('color-info-tint')],
  'warning alert': ['glass-bg', tint('color-warning-tint')],
  'warning alert in a panel': ['glass-bg', 'glass-bg', tint('color-warning-tint')],
  'danger alert': ['glass-bg', tint('color-danger-tint')],
  'danger alert in a panel': ['glass-bg', 'glass-bg', tint('color-danger-tint')],
  'success alert': ['glass-bg', tint('color-success-tint')],
  'control in the success alert': ['glass-bg', tint('color-success-tint'), 'glass-bg-strong'],
  'primary button': ['color-primary-bg'],
};

function pair(fg, surface, where, required = TEXT) {
  return { fg, surface, where, required };
}

const PAIRS = [
  pair('text', 'page', 'h1 on the backdrop'),
  pair('text', 'glass', 'panel, card and header text'),
  pair('text', 'control', 'input and button text'),
  pair('text', 'control in the success alert', '"Create another" after a delete'),
  pair('text', 'hovered control', 'hovered button text'),
  pair('text', 'code', 'code, plain tokens'),
  pair('text-secondary', 'page', 'lead paragraphs'),
  pair('text-secondary', 'glass', 'secondary text in panels and cards'),
  pair('text-secondary', 'control', 'select chevron'),
  pair('text-secondary', 'opened strip', 'opened seal strip'),
  pair('text-secondary', 'delete link box', 'delete link label and help line'),
  pair('text', 'control in the delete link box', 'delete link field and "Copy" label'),
  pair('text', 'hovered control in the delete link box', 'hovered "Copy" button'),
  pair('success', 'control in the delete link box', '"Copied" on the delete link button'),
  pair('text-muted', 'glass', 'metadata in panels, footer'),
  pair('text-muted', 'control', 'placeholder, line count, cap note'),
  pair('text-muted', 'hovered control', 'muted text on a hovered control'),
  pair('text-muted', 'code', 'line numbers'),
  pair('accent', 'glass', 'links in panels, footer link'),
  pair('accent-hover', 'glass', 'hovered link in a panel or the footer'),
  pair('accent', 'sealed strip', 'sealed strip'),
  pair('accent', 'selected segment', 'selected segment, pressed toggle'),
  pair('danger', 'glass', 'field error text'),
  pair('warning', 'glass', 'meter text near the limit'),
  pair('success', 'control', '"Copied" label'),
  pair('danger', 'destroyed strip', 'destroyed strip'),
  pair('warning', 'expired strip', 'expired strip'),
  pair('info', 'info alert', 'info callout title'),
  pair('info', 'info alert in a panel', 'info callout title in a panel'),
  pair('warning', 'warning alert', 'warning callout title'),
  pair('warning', 'warning alert in a panel', 'warning callout title in a panel'),
  pair('danger', 'danger alert', 'danger callout title'),
  pair('danger', 'danger alert in a panel', 'danger callout title in a panel'),
  pair('success', 'success alert', 'success callout title'),
  pair('text', 'info alert', 'info callout body'),
  pair('text', 'info alert in a panel', 'info callout body in a panel'),
  pair('text', 'warning alert', 'warning callout body'),
  pair('text', 'warning alert in a panel', 'warning callout body in a panel'),
  pair('text', 'danger alert', 'danger callout body'),
  pair('text', 'danger alert in a panel', 'danger callout body in a panel'),
  pair('text', 'success alert', 'success callout body'),
  pair('on-primary', 'primary button', 'primary button label'),
  ...[
    'syntax-comment',
    'syntax-keyword',
    'syntax-string',
    'syntax-number',
    'syntax-function',
    'syntax-type',
    'syntax-attribute',
    'syntax-tag',
    'syntax-meta',
  ].map((token) => pair(token, 'code', 'syntax highlighting')),
  pair('border-strong', 'glass', 'control borders in panels and cards', GRAPHIC),
  pair('border-strong', 'control', 'control border against its own fill', GRAPHIC),
  pair('border-strong', 'hovered control', 'control border, hovered', GRAPHIC),
  pair('border-strong', 'success alert', '"Create another" border after a delete', GRAPHIC),
  pair('border-strong', 'delete link box', 'control borders in the delete link box', GRAPHIC),
  pair('border-strong', 'control in the delete link box', 'delete link field border', GRAPHIC),
  pair('focus', 'delete link box', 'focus ring in the delete link box', GRAPHIC),
  pair('accent', 'control', 'checked radio, selected segment ring', GRAPHIC),
  pair('focus', 'page', 'focus ring on the page', GRAPHIC),
  pair('focus', 'glass', 'focus ring in panels and cards', GRAPHIC),
  pair('focus', 'code', 'inset focus ring in the code viewer', GRAPHIC),
  ...['text-muted', 'warning', 'danger', 'success', 'info'].map((token) =>
    pair(token, 'glass', 'status page icon', GRAPHIC),
  ),
];

function block(css, selector, from = 0) {
  const start = css.indexOf(selector, from);
  if (start === -1) {
    throw new Error(`tokens.css has no "${selector}" block`);
  }
  const open = css.indexOf('{', start + selector.length - 1);
  const close = css.indexOf('}', open);
  return new Map(
    [...css.slice(open + 1, close).matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map(
      ([, name, value]) => [name, value.replace(/\s+/g, ' ').trim()],
    ),
  );
}

function parseColour(value) {
  if (value === 'transparent') {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const n = Number.parseInt(hex[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const rgba = /^rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\s*\)$/.exec(value);
  if (rgba) {
    const [, r, g, b, a = '1'] = rgba;
    return { r: Number(r), g: Number(g), b: Number(b), a: Number(a) };
  }
  throw new Error(`Cannot read the colour "${value}"`);
}

function resolver(tokens) {
  const resolve = (name) => {
    const value = tokens.get(name);
    if (value === undefined) {
      throw new Error(`tokens.css has no --${name}`);
    }
    const reference = /^var\(--([a-z0-9-]+)\)$/.exec(value);
    return reference ? resolve(reference[1]) : value;
  };
  return {
    colour: (name) => parseColour(resolve(name)),
    fraction: (name) => {
      const percent = /^([\d.]+)%$/.exec(resolve(name));
      if (!percent) {
        throw new Error(`--${name} must be a percentage`);
      }
      return Number(percent[1]) / 100;
    },
  };
}

function over(top, bottom) {
  const a = top.a;
  return {
    r: top.r * a + bottom.r * (1 - a),
    g: top.g * a + bottom.g * (1 - a),
    b: top.b * a + bottom.b * (1 - a),
    a: 1,
  };
}

function luminance({ r, g, b }) {
  const channel = (value) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function ratio(first, second) {
  const [light, dark] = [luminance(first), luminance(second)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

function floor2(value) {
  return Math.floor(value * 100) / 100;
}

function backdrops(theme) {
  const bg = theme.colour('color-bg');
  return [
    { name: 'plain', colour: bg },
    ...GLOWS.map((glow) => ({ name: glow, colour: over(theme.colour(glow), bg) })),
  ];
}

function surfaceColour(theme, surface, backdrop) {
  return SURFACES[surface].reduce((below, layer) => {
    if (typeof layer === 'string') {
      return over(theme.colour(layer), below);
    }
    const colour = theme.colour(layer.tint);
    return over({ ...colour, a: colour.a * theme.fraction('glass-tint') }, below);
  }, backdrop);
}

function measure(theme) {
  const points = backdrops(theme);
  return PAIRS.map(({ fg, surface }) => {
    const text = theme.colour(`color-${fg}`.replace('color-syntax-', 'syntax-'));
    const ratios = points.map((point) => ({
      point: point.name,
      ratio: ratio(text, surfaceColour(theme, surface, point.colour)),
    }));
    const glowRatios = ratios.slice(1);
    const worstGlow = glowRatios.reduce((low, next) => (next.ratio < low.ratio ? next : low));
    return { plain: ratios[0].ratio, glow: worstGlow };
  });
}

function themesFrom(css, fallbackFrom) {
  const fallback =
    fallbackFrom === undefined ? new Map() : block(css, THEMES.light, css.indexOf(fallbackFrom));
  return Object.fromEntries(
    Object.entries(THEMES).map(([name, selector]) => [
      name,
      resolver(new Map([...block(css, THEMES.dark), ...block(css, selector), ...fallback])),
    ]),
  );
}

function format(value) {
  return `${floor2(value).toFixed(2)}:1`;
}

function printTable(rows) {
  const columns = ['pair', 'where', 'dark', 'light', 'required', 'result'];
  const header = {
    pair: 'Pair',
    where: 'Where',
    dark: 'Dark plain / glow',
    light: 'Light plain / glow',
    required: 'Required',
    result: 'Result',
  };
  const lines = [header, ...rows];
  const width = (field) => Math.max(...lines.map((line) => line[field].length));
  const render = (line) =>
    columns
      .map((field, index) =>
        index === columns.length - 1 ? line[field] : line[field].padEnd(width(field)),
      )
      .join(' | ');
  console.log(render(header));
  console.log(columns.map((field) => '-'.repeat(width(field))).join('-|-'));
  rows.forEach((line) => console.log(render(line)));
}

function lowest(results, theme) {
  return results
    .map((result, index) => ({
      ...result[theme],
      low: Math.min(result[theme].plain, result[theme].glow.ratio),
      pair: PAIRS[index],
    }))
    .filter(({ pair: { required } }) => required === TEXT)
    .reduce((low, next) => (next.low < low.low ? next : low));
}

function describeLowest(entry) {
  const { fg, surface } = entry.pair;
  const where = entry.plain <= entry.glow.ratio ? 'plain page' : `${entry.glow.point} centre`;
  return `${fg} on ${surface} at ${format(entry.low)} (${where})`;
}

try {
  const css = await readFile(TOKENS_FILE, 'utf8');
  const glass = themesFrom(css);
  const opaque = themesFrom(css, FALLBACK);
  const measured = { dark: measure(glass.dark), light: measure(glass.light) };
  const fallback = { dark: measure(opaque.dark), light: measure(opaque.light) };

  const results = PAIRS.map((_, index) => ({
    dark: measured.dark[index],
    light: measured.light[index],
  }));
  const rows = results.map(({ dark, light }, index) => {
    const { fg, surface, where, required } = PAIRS[index];
    const passes = [dark.plain, dark.glow.ratio, light.plain, light.glow.ratio].every(
      (value) => floor2(value) >= required,
    );
    return {
      pair: `${fg} on ${surface}`,
      where,
      dark: `${format(dark.plain)} / ${format(dark.glow.ratio)}`,
      light: `${format(light.plain)} / ${format(light.glow.ratio)}`,
      required: `${required}:1`,
      result: passes ? 'ok' : 'FAILS',
      passes,
    };
  });
  const fallbackFailures = PAIRS.filter((_, index) =>
    ['dark', 'light'].some((theme) => {
      const { plain, glow } = fallback[theme][index];
      return floor2(Math.min(plain, glow.ratio)) < PAIRS[index].required;
    }),
  );

  console.log(
    'Contrast on glass. Each surface is composited over the plain page and over the centre of each glow at full strength; the glow column shows the worst glow.\n',
  );
  printTable(rows);
  console.log(`\nLowest text pair, dark: ${describeLowest(lowest(results, 'dark'))}`);
  console.log(`Lowest text pair, light: ${describeLowest(lowest(results, 'light'))}`);

  const failures = rows.filter(({ passes }) => !passes);
  if (failures.length > 0 || fallbackFailures.length > 0) {
    const names = [
      ...failures.map(({ pair: name }) => name),
      ...fallbackFailures.map(({ fg, surface }) => `${fg} on ${surface} (opaque fallback)`),
    ];
    console.error(`\nContrast below the requirement: ${names.join('; ')}.`);
    process.exitCode = 1;
  } else {
    console.log('\nEvery pair holds on glass at every point, and on the opaque fallback surfaces.');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
