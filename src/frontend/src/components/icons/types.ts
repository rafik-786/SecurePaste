import type { ReactElement } from 'react';

export type IconSize = 16 | 20 | 24 | 32;

export interface IconProps {
  readonly size?: IconSize;
  readonly className?: string | undefined;
}

export type IconComponent = (props: IconProps) => ReactElement;
