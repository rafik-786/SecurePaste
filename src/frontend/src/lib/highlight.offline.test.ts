import { describe, expect, it, vi } from 'vitest';
import { highlight, preloadHighlighter } from './highlight';

vi.mock('highlight.js/lib/core', () => {
  throw new Error('Failed to fetch dynamically imported module');
});

describe('highlight when the highlighter chunk cannot load', () => {
  it('falls back to escaped plain text', async () => {
    await expect(highlight('def f(): return "<b>"', 'python')).resolves.toBe(
      'def f(): return &quot;&lt;b&gt;&quot;',
    );
  });

  it('lets a failed preload pass quietly and still falls back', async () => {
    preloadHighlighter();

    await expect(highlight('x = 1', 'python')).resolves.toBe('x = 1');
  });

  it('retries on later calls and keeps falling back while the chunk stays unavailable', async () => {
    await highlight('def first(): pass', 'python');

    await expect(highlight('class A: pass', 'python')).resolves.toBe('class A: pass');
  });
});
