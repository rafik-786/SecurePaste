import type { ReactNode } from 'react';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { MAIN_ID, SkipLink } from '../components/SkipLink';
import styles from './Shell.module.css';

export function Shell({ children }: { readonly children: ReactNode }) {
  return (
    <>
      <SkipLink />
      <Header />
      <main id={MAIN_ID} tabIndex={-1} className={styles.main}>
        {children}
      </main>
      <Footer />
    </>
  );
}
