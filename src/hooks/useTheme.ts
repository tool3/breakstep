import { useCallback, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';

export type ThemeName = 'graphite' | 'midnight' | 'light';

/**
 * The handful of colours Ant Design needs as JavaScript values.
 *
 * Everything else comes from the CSS custom properties in `global.scss`, but
 * antd's config is built before paint and renders into portals, so it cannot
 * read them. Keep these in step with the matching block there — they are the
 * same palette, said twice because two consumers need it in two forms.
 */
export interface AntdTokens {
  bg: string;
  container: string;
  elevated: string;
  border: string;
  borderSecondary: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  primary: string;
  success: string;
  warning: string;
  error: string;
  segmentedSelected: string;
}

export interface ThemeDefinition {
  value: ThemeName;
  label: string;
  hint: string;
  /** Drives the browser UI colour and the initial paint. */
  chrome: string;
  dark: boolean;
  antd: AntdTokens;
}

export const THEMES: ThemeDefinition[] = [
  {
    value: 'graphite',
    label: 'Graphite',
    hint: 'Softer dark — the most readable over long sessions',
    chrome: '#1a1a1a',
    dark: true,
    antd: {
      bg: '#1a1a1a',
      container: '#282828',
      elevated: '#373737',
      border: '#3e3e3e',
      borderSecondary: '#303030',
      text: '#eff1f6',
      textSecondary: 'rgba(239, 241, 246, 0.66)',
      textTertiary: 'rgba(239, 241, 246, 0.42)',
      primary: '#58a6ff',
      success: '#2cbb5d',
      warning: '#ffb800',
      error: '#ef4743',
      segmentedSelected: '#3a3a3a',
    },
  },
  {
    value: 'midnight',
    label: 'Midnight',
    hint: 'Near-black, neutral greys',
    chrome: '#08090b',
    dark: true,
    antd: {
      bg: '#08090b',
      container: '#0d0e11',
      elevated: '#17181d',
      border: '#1d1e23',
      borderSecondary: '#17181d',
      text: '#e3e5ea',
      textSecondary: '#949aa5',
      textTertiary: '#5d626c',
      primary: '#5f8dff',
      success: '#35d6a0',
      warning: '#f2a53c',
      error: '#f4585d',
      segmentedSelected: '#1c1e25',
    },
  },
  {
    value: 'light',
    label: 'Light',
    hint: 'For bright rooms',
    chrome: '#f6f7f9',
    dark: false,
    antd: {
      bg: '#f6f7f9',
      container: '#ffffff',
      elevated: '#ffffff',
      border: '#e0e4ea',
      borderSecondary: '#eceef2',
      text: '#1c2430',
      textSecondary: '#5a6675',
      textTertiary: '#8b95a5',
      primary: '#2f6bea',
      success: '#0f9d6f',
      warning: '#c47c14',
      error: '#d13b41',
      segmentedSelected: '#e8effd',
    },
  },
];

/**
 * Graphite is the default.
 *
 * Near-black looks striking in a screenshot and is tiring to read for an hour;
 * a lighter charcoal with softened near-white text holds contrast without the
 * glare. Midnight is still there for anyone who prefers it.
 */
export const DEFAULT_THEME: ThemeName = 'graphite';

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

  // Themes that no longer exist — an early build's 'dark', and 'slate', which
  // Graphite replaced — resolve to the default rather than leaving the app with
  // no tokens at all.
  const resolved: ThemeName = THEMES.some((t) => t.value === theme) ? theme : DEFAULT_THEME;

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
