import { AlertIcon } from '../../components/icons/icons';
import { StatusPage } from '../../components/StatusPage';

export function UnsupportedStatus() {
  return (
    <StatusPage icon={AlertIcon} tone="warning" title="This browser cannot encrypt here">
      <p>
        SecurePaste encrypts and decrypts in your browser with the Web Crypto API, which only runs
        on secure (HTTPS) pages in current browsers. Open the site over HTTPS, or in a current
        version of Firefox, Chrome, Edge or Safari. Nothing was sent or used.
      </p>
    </StatusPage>
  );
}
