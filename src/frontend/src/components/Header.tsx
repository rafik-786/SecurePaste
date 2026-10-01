import type { MouseEvent } from 'react';
import { Link, NavLink } from 'react-router';
import { useConfirmLeave } from '../hooks/leaveGuard';
import { cx } from '../lib/classNames';
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
    <header className={styles.header}>
      <div className={styles.container}>
        <Link to="/" className={styles.wordmark} onClick={guardLeave}>
          <LockIcon size={20} className={styles.lock} />
          <span>{PRODUCT_NAME}</span>
        </Link>
        <nav aria-label="Main" className={styles.nav}>
          <NavLink to="/about" className={cx(styles.navLink)} onClick={guardLeave}>
            About
          </NavLink>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
