import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'picai-theme' }
  )
);

/** Call once at app startup and whenever store changes to sync the `dark` class on <html>. */
export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}
