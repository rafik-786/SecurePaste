import styles from './SkipLink.module.css';

export const MAIN_ID = 'main';

export function SkipLink() {
  return (
    <a
      className={styles.skipLink}
      href={`#${MAIN_ID}`}
      onClick={(event) => {
        // The fragment holds the paste key, so following #main would overwrite it.
        event.preventDefault();
        document.getElementById(MAIN_ID)?.focus();
      }}
    >
      Skip to content
    </a>
  );
}
