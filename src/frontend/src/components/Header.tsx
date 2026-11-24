import type { MouseEvent } from 'react';
import { Link } from 'react-router';
import { useConfirmLeave } from '../hooks/leaveGuard';
import { cx, GLASS_CLASS } from '../lib/classNames';
import { PRODUCT_NAME } from '../lib/product';
import { LockIcon } from './icons/icons';
import { ThemeToggle } from './ThemeToggle';
import styles from './Header.module.css';

export function Header() {
  const confirmLeave = useConfirmLeave();
  const guardLeave = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!confirmLeave()) {
      event.preventDefault();
    }
  };

  return (
    <header className={cx(GLASS_CLASS, styles.header)}>
      <div className={styles.container}>
        <Link to="/" className={styles.wordmark} onClick={guardLeave}>
          <LockIcon size={20} className={styles.lock} />
          <span>{PRODUCT_NAME}</span>
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
