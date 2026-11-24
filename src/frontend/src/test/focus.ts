import { waitFor } from '@testing-library/react';
import { expect } from 'vitest';

// Focus moves in an effect after the commit that shows the element, so a find query can resolve
// a moment before focus lands.
export async function expectFocus(element: HTMLElement): Promise<void> {
  await waitFor(() => {
    expect(element).toHaveFocus();
  });
}
