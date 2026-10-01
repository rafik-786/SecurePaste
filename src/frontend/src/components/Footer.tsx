import { ExternalIcon } from './icons/icons';
import styles from './Footer.module.css';

const WEB_URL = /^https?:\/\//;

export interface FooterProps {
  readonly sourceUrl?: string | undefined;
}

export function Footer({ sourceUrl = import.meta.env.VITE_SOURCE_URL }: FooterProps) {
  const showSource = sourceUrl !== undefined && WEB_URL.test(sourceUrl);

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <p>Encrypted in your browser. The server only stores ciphertext.</p>
        {showSource && (
          <a className={styles.source} href={sourceUrl} target="_blank" rel="noopener noreferrer">
            Source code <ExternalIcon />{' '}
            <span className="visually-hidden">(opens in a new tab)</span>
          </a>
        )}
      </div>
    </footer>
  );
}
