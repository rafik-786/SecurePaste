import { Button } from '../../components/Button';

export interface TryAgainButtonProps {
  readonly onRetry: () => void;
  readonly waiting?: boolean;
}

export function TryAgainButton({ onRetry, waiting = false }: TryAgainButtonProps) {
  return (
    <Button variant="primary" disabled={waiting} onClick={onRetry}>
      Try again
    </Button>
  );
}
