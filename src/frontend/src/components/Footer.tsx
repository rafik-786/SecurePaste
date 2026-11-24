import { cx, GLASS_CLASS } from '../lib/classNames';
import { ExternalIcon } from './icons/icons';
import styles from './Footer.module.css';

const WEB_URL = /^https?:\/\//;

export interface FooterProps {
  readonly sourceUrl?: string | undefined;
}

export function Footer({ sourceUrl = import.meta.env.VITE_SOURCE_URL }: FooterProps) {
  if (sourceUrl === undefined || !WEB_URL.test(sourceUrl)) {
    return null;
  }

  return (
    <footer className={cx(GLASS_CLASS, styles.footer)}>
      <div className={styles.container}>
        <a className={styles.source} href={sourceUrl} target="_blank" rel="noopener noreferrer">
          Source code <ExternalIcon /> <span className="visually-hidden">(opens in a new tab)</span>
        </a>
      </div>
    </footer>
  );
}
