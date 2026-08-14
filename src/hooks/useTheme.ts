import { useCallback, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';

export type ThemeName = 'midnight' | 'slate' | 'light';

export interface ThemeDefinition {
  value: ThemeName;
  label: string;
  hint: string;
  /** Drives the browser UI colour and the initial paint. */
  chrome: string;
  dark: boolean;
}

export const THEMES: ThemeDefinition[] = [
  {
    value: 'midnight',
    label: 'Midnight',
    hint: 'Near-black, neutral greys',
    chrome: '#08090b',
    dark: true,
  },
  {
    value: 'slate',
    label: 'Slate',
    hint: 'Cooler, blue-tinted dark',
    chrome: '#0b0e14',
    dark: true,
  },
  {
    value: 'light',
    label: 'Light',
    hint: 'For bright rooms',
    chrome: '#f6f7f9',
    dark: false,
  },
];

export const DEFAULT_THEME: ThemeName = 'midnight';

export function isDarkTheme(theme: ThemeName): boolean {
  return THEMES.find((t) => t.value === theme)?.dark ?? true;
}

export function themeDefinition(theme: ThemeName): ThemeDefinition {
  return THEMES.find((t) => t.value === theme) ?? THEMES[0];
}

/**
 * Theme lives on `<html data-theme>` so the CSS custom properties in
 * `global.scss` switch without a re-render cascade, and so the initial paint
 * (set in `index.html`) never flashes.
 */
export function useTheme(): {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  toggle: () => void;
  isDark: boolean;
} {
  const [theme, setTheme] = useLocalStorage<ThemeName>('theme', DEFAULT_THEME);

  // An older build stored 'dark'; map it onto the closest current theme.
  const resolved: ThemeName = THEMES.some((t) => t.value === theme)
    ? theme
    : ((theme as string) === 'dark' ? 'slate' : DEFAULT_THEME);

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', themeDefinition(resolved).chrome);
  }, [resolved]);

  /** Quick swap between the current dark theme and light, for the header button. */
  const toggle = useCallback(() => {
    setTheme((prev) => (isDarkTheme(prev as ThemeName) ? 'light' : DEFAULT_THEME));
  }, [setTheme]);

  return { theme: resolved, setTheme, toggle, isDark: isDarkTheme(resolved) };
}
