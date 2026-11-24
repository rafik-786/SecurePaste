import { useAnnounce } from '../hooks/announcer';
import { useTheme } from '../hooks/useTheme';
import { chooseTheme, oppositeTheme } from '../lib/theme';
import { IconButton } from './IconButton';
import { MoonIcon, SunIcon } from './icons/icons';

export function ThemeToggle() {
  const theme = useTheme();
  const announce = useAnnounce();
  const next = oppositeTheme(theme);

  return (
    <IconButton
      label={next === 'dark' ? 'Switch to dark theme' : 'Switch to light theme'}
      icon={theme === 'light' ? MoonIcon : SunIcon}
      onClick={() => {
        chooseTheme(next);
        announce(next === 'dark' ? 'Dark theme.' : 'Light theme.');
      }}
    />
  );
}
