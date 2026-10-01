import { formatAbsolute, formatExpiryLabel } from '../lib/time';

export interface ExpiryTimeProps {
  readonly expiresAt: Date;
  readonly now: Date;
}

export function ExpiryTime({ expiresAt, now }: ExpiryTimeProps) {
  return (
    <time dateTime={expiresAt.toISOString()} title={formatAbsolute(expiresAt)}>
      {formatExpiryLabel(expiresAt, now)}
    </time>
  );
}
