import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/services/api'
import type { User } from '@/types'

type Session = { user: User; token: string }
function readSession(): Session | null { try { return JSON.parse(localStorage.getItem('reservio-session') || 'null') } catch { return null } }

export const useAuthStore = defineStore('auth', () => {
  const initial = readSession()
  const user = ref<User | null>(initial?.user || null)
  const token = ref(initial?.token || '')
  const isAuthenticated = computed(() => Boolean(user.value && token.value))

  function saveSession(session: Session) {
    user.value = session.user; token.value = session.token
    localStorage.setItem('reservio-session', JSON.stringify(session))
  }
  async function login(email: string, password: string) { saveSession(await api<Session>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })) }
  async function register(payload: { token: string; name: string; email: string; phoneNumber?: string; password: string }) { saveSession(await api<Session>('/auth/register', { method: 'POST', body: JSON.stringify(payload) })) }
  async function refresh() { const data = await api<{ user: User }>('/me'); user.value = data.user; localStorage.setItem('reservio-session', JSON.stringify({ user: user.value, token: token.value })) }
  async function updateProfile(profile: { name: string; phoneNumber?: string | null }) { const data = await api<{ user: User }>('/me', { method: 'PATCH', body: JSON.stringify(profile) }); user.value = data.user; localStorage.setItem('reservio-session', JSON.stringify({ user: user.value, token: token.value })) }
  function logout() { user.value = null; token.value = ''; localStorage.removeItem('reservio-session') }
  return { user, token, isAuthenticated, login, register, refresh, updateProfile, logout }
})
