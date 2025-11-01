import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone?: string;
  timezone?: string;
}

const STORAGE_KEY = 'reservation-app-user';

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2, 10)}`;
}

function loadStoredUser(): UserProfile | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserProfile;
  } catch (error) {
    console.warn('Failed to parse stored user', error);
    return null;
  }
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserProfile | null>(loadStoredUser());
  const isAuthenticated = computed(() => user.value !== null);

  function persist() {
    if (typeof window === 'undefined') return;
    if (user.value) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user.value));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  function login(email: string, password: string) {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }
    user.value = {
      id: createId(),
      email,
      name: email.split('@')[0] ?? 'New User'
    };
    persist();
  }

  function signup(email: string, password: string, name: string) {
    if (!email || !password || !name) {
      throw new Error('All fields are required');
    }
    user.value = {
      id: createId(),
      email,
      name
    };
    persist();
  }

  function logout() {
    user.value = null;
    persist();
  }

  function updateProfile(update: Partial<UserProfile>) {
    if (!user.value) return;
    user.value = { ...user.value, ...update };
    persist();
  }

  return {
    user,
    isAuthenticated,
    login,
    signup,
    logout,
    updateProfile
  };
});
