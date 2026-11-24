import { LinkButton, type ButtonVariant } from '../../components/Button';

export interface CreatePasteLinkProps {
  readonly variant?: Extract<ButtonVariant, 'primary' | 'secondary'>;
}

export function CreatePasteLink({ variant = 'secondary' }: CreatePasteLinkProps) {
  return (
    <LinkButton to="/" variant={variant}>
      Create a paste
    </LinkButton>
  );
}
