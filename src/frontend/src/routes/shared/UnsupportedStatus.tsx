import { AlertIcon } from '../../components/icons/icons';
import { StatusPage } from '../../components/StatusPage';

export function UnsupportedStatus() {
  return (
    <StatusPage icon={AlertIcon} tone="warning" title="Encryption isn't available here">
      <p>Open this page over HTTPS in a current browser. Nothing was sent.</p>
    </StatusPage>
  );
}
