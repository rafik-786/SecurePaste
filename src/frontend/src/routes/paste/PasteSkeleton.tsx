import { Panel } from '../../components/Panel';
import { LoadingStatus } from '../../components/Spinner';
import styles from './PasteSkeleton.module.css';

export interface PasteSkeletonProps {
  readonly label: string;
  readonly bodyClassName: string | undefined;
}

export function PasteSkeleton({ label, bodyClassName }: PasteSkeletonProps) {
  return (
    <Panel
      strip={<div className={styles.strip} aria-hidden="true" />}
      bodyClassName={bodyClassName}
    >
      <LoadingStatus label={label} />
    </Panel>
  );
}
