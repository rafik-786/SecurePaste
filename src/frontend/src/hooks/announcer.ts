import { createContext, useContext } from 'react';

export type Announce = (message: string) => void;

export const ANNOUNCE_DELAY_MS = 50;

export const AnnounceContext = createContext<Announce | null>(null);

export function useAnnounce(): Announce {
  const announce = useContext(AnnounceContext);
  if (!announce) {
    throw new Error('useAnnounce needs an AnnouncerProvider above it.');
  }
  return announce;
}
