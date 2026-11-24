import { SvgIcon } from './SvgIcon';
import type { IconProps } from './types';

export function LockIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </SvgIcon>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M9 16H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v2" />
    </SvgIcon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M4.5 12.5l5 5L19.5 7" />
    </SvgIcon>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M4 7h16" />
      <path d="M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
      <path d="M10 11v6M14 11v6" />
    </SvgIcon>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M2.5 12C5 7.33 8.17 5 12 5s7 2.33 9.5 7c-2.5 4.67-5.67 7-9.5 7s-7-2.33-9.5-7z" />
      <circle cx="12" cy="12" r="3" />
    </SvgIcon>
  );
}

export function FlameIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M12 3C9 6.5 6 9.8 6 14a6 6 0 0 0 12 0c0-4.2-3-7.5-6-11z" />
      <path d="M12 12.5c-1.25 1.4-2.5 2.6-2.5 4.3a2.5 2.5 0 0 0 5 0c0-1.7-1.25-2.9-2.5-4.3z" />
    </SvgIcon>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </SvgIcon>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M10.27 4.5a2 2 0 0 1 3.46 0l7.36 12.75a2 2 0 0 1-1.73 3H4.64a2 2 0 0 1-1.73-3z" />
      <path d="M12 9.5v4" />
      <path d="M12 17h.01" />
    </SvgIcon>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <path d="M12 7.75h.01" />
    </SvgIcon>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
      <path d="M5.64 5.64l1.41 1.41M16.95 16.95l1.41 1.41M5.64 18.36l1.41-1.41M16.95 7.05l1.41-1.41" />
    </SvgIcon>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M12 3a6.5 6.5 0 0 0 9 9 9 9 0 1 1-9-9z" />
    </SvgIcon>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M12 3.5v11" />
      <path d="M7.5 10l4.5 4.5 4.5-4.5" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </SvgIcon>
  );
}

export function WrapIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M4 5h16" />
      <path d="M4 10h16" />
      <path d="M4 15h12.5a2.5 2.5 0 0 1 0 5H13" />
      <path d="M14.5 18.5L13 20l1.5 1.5" />
    </SvgIcon>
  );
}

export function ExternalIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M18 13.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5.5" />
      <path d="M14 4h6v6" />
      <path d="M20 4l-9 9" />
    </SvgIcon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M6 9l6 6 6-6" />
    </SvgIcon>
  );
}

export function UnlinkIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M9.5 7.5H7a4.5 4.5 0 0 0 0 9h2.5" />
      <path d="M14.5 7.5H17a4.5 4.5 0 0 1 0 9h-2.5" />
      <path d="M7.5 12H9M15 12h1.5" />
      <path d="M12 3v2.5M12 18.5V21" />
    </SvgIcon>
  );
}

export function OfflineIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 10 0 4 4 0 0 1 0 8z" />
      <path d="M3 3l18 18" />
    </SvgIcon>
  );
}
