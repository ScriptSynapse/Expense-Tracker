/**
 * store/index.js — Zustand global state management
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI } from '../services/api';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (credentials) => {
        const res = await authAPI.login(credentials);
        const { token, user } = res.data;
        localStorage.setItem('token', token);
        set({ user, token, isAuthenticated: true });
        return user;
      },

      register: async (data) => {
        const res = await authAPI.register(data);
        const { token, user } = res.data;
        localStorage.setItem('token', token);
        set({ user, token, isAuthenticated: true });
        return user;
      },

      logout: () => {
        localStorage.removeItem('token');
        set({ user: null, token: null, isAuthenticated: false });
      },

      updateUser: (user) => set({ user }),

      loadUser: async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
          const res = await authAPI.getMe();
          set({ user: res.data.user, isAuthenticated: true });
        } catch {
          get().logout();
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);

export const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: 'system',
      isDark: false,

      setTheme: (theme) => {
        const isDark =
          theme === 'dark' ||
          (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        document.documentElement.classList.toggle('dark', isDark);
        set({ theme, isDark });
      },

      initTheme: () => {
        const { theme } = get();
        const isDark =
          theme === 'dark' ||
          (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        document.documentElement.classList.toggle('dark', isDark);
        set({ isDark });
      },
    }),
    { name: 'theme-storage' }
  )
);
