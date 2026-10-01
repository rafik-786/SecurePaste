import { useEffect, useState } from 'react';
import { encryptedByteSize } from '../lib/crypto';

export function measureEncryptedSize(content: string, language: string): number {
  return content === '' ? 0 : encryptedByteSize({ content, language });
}

export function useEncryptedSize(content: string, language: string): number {
  const [bytes, setBytes] = useState(() => measureEncryptedSize(content, language));

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setBytes(measureEncryptedSize(content, language));
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [content, language]);

  return bytes;
}
