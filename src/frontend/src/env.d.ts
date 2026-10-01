import 'react';

declare global {
  interface ImportMetaEnv {
    readonly VITE_SOURCE_URL?: string;
  }
}

declare module 'react' {
  // Declaration merging needs an interface, which a Record alias cannot provide.
  // eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
  interface CSSProperties {
    [customProperty: `--${string}`]: string | number | undefined;
  }
}
