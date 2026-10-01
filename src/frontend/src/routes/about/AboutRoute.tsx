import { useId } from 'react';
import { PageHeading } from '../../components/PageHeading';
import styles from './AboutRoute.module.css';

const STORED = [
  'The encrypted bytes',
  'When it expires',
  'The view limit and views used',
  'A hash of the delete token',
] as const;

const NEVER_STORED = ['The text', 'The key', 'The language', 'Who created it'] as const;

export function AboutRoute() {
  const storedId = useId();
  const neverStoredId = useId();

  return (
    <article className={styles.about}>
      <PageHeading>How SecurePaste works</PageHeading>
      <p className={styles.lead}>
        SecurePaste is a pastebin for things that should not stay around: credentials,
        configuration, logs with tokens in them. Every paste is encrypted in your browser and
        destroys itself.
      </p>

      <section className={styles.section}>
        <h2>When you create a paste</h2>
        <ol>
          <li>
            Your browser generates a random 256-bit key and encrypts the text and its language with
            AES-256-GCM.
          </li>
          <li>
            Only the encrypted bytes go to the server, with the expiry and view limit you chose.
          </li>
          <li>
            The key goes after the # in the share link. Browsers never send that part of a link to a
            server, so the server never has it.
          </li>
        </ol>
      </section>

      <section className={styles.section}>
        <h2>When someone opens the link</h2>
        <p>
          The page first asks the server whether the paste still exists. That uses up nothing. If
          the paste has a view limit, nothing is downloaded until the reader clicks Reveal. Then the
          server counts the view and sends the encrypted bytes, and the browser decrypts them with
          the key from the link.
        </p>
        <p>
          If the encrypted bytes were changed in any way, decryption fails and nothing is shown.
        </p>
      </section>

      <section className={styles.section}>
        <h2>What the server stores</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Stored</th>
              <th scope="col">Never stored</th>
            </tr>
          </thead>
          <tbody>
            {STORED.map((stored, index) => (
              <tr key={stored}>
                <td>{stored}</td>
                <td>{NEVER_STORED[index]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className={styles.lists}>
          <p id={storedId} className={styles.listHeading}>
            Stored
          </p>
          <ul aria-labelledby={storedId}>
            {STORED.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p id={neverStoredId} className={styles.listHeading}>
            Never stored
          </p>
          <ul aria-labelledby={neverStoredId}>
            {NEVER_STORED.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <p>
          Your network address is used for rate limiting in memory and is not stored with the paste.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Limits</h2>
        <ul>
          <li>Expiry: 15 minutes, 1 hour, 1 day or 7 days. There are no permanent pastes.</li>
          <li>Views: burn after reading, 1 to 100 views, or unlimited until expiry.</li>
          <li>Size: 256 KB after encryption.</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>What this does not protect against</h2>
        <ul>
          <li>
            Anyone who has the link can read the paste. The link is the key, so send it over a
            channel you trust.
          </li>
          <li>
            The server delivers the code that does the encryption. A compromised server could
            deliver code that leaks keys. The source is open so this can be checked.
          </li>
          <li>
            Whoever opens a view-limited link first gets the view. If you open a link and the paste
            is already gone, someone may have read it before you: tell the sender.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>Privacy</h2>
        <p>
          No accounts, no analytics, no cookies, no requests to other sites. The only thing this
          site stores in your browser is your light or dark theme choice.
        </p>
      </section>
    </article>
  );
}
