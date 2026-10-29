import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/services/api'
import type { User } from '@/types'
import { i18n } from '@/i18n'

type Session = { user: User; token: string }
function readSession(): Session | null { try { return JSON.parse(localStorage.getItem('reservio-admin-session') || 'null') } catch { return null } }
export const useAuthStore = defineStore('admin-auth', () => {
  const initial = readSession(); const user = ref<User | null>(initial?.user || null); const token = ref(initial?.token || '')
  const isAuthenticated = computed(() => Boolean(user.value && token.value && user.value?.role === 'ADMIN'))
  async function login(email: string, password: string) { const session = await api<Session>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); if (session.user.role !== 'ADMIN') throw new Error(i18n.global.t('login.adminRequired')); user.value = session.user; token.value = session.token; localStorage.setItem('reservio-admin-session', JSON.stringify(session)) }
  function logout() { user.value = null; token.value = ''; localStorage.removeItem('reservio-admin-session') }
  return { user, token, isAuthenticated, login, logout }
})
