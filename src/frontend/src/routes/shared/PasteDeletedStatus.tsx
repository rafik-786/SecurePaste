import type { ReactNode } from 'react';
import { CheckIcon } from '../../components/icons/icons';
import { StatusPage } from '../../components/StatusPage';

export interface PasteDeletedStatusProps {
  readonly action: ReactNode;
}

export function PasteDeletedStatus({ action }: PasteDeletedStatusProps) {
  return (
    <StatusPage icon={CheckIcon} tone="success" title="Paste deleted" actions={action}>
      <p>The link no longer works.</p>
    </StatusPage>
  );
}
