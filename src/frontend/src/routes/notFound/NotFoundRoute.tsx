import { UnlinkIcon } from '../../components/icons/icons';
import { StatusPage } from '../../components/StatusPage';
import { CreatePasteLink } from '../shared/CreatePasteLink';

export function NotFoundRoute() {
  return (
    <StatusPage
      icon={UnlinkIcon}
      tone="neutral"
      title="Page not found"
      actions={<CreatePasteLink variant="primary" />}
    >
      <p>Paste links start with /p/ and delete links with /d/. Check the link you used.</p>
    </StatusPage>
  );
}
