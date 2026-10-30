import { ref, watch } from 'vue'

const storageKey = 'reservio-theme'
const stored = localStorage.getItem(storageKey)
const initial = stored === 'dark' || stored === 'light'
  ? stored
  : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
export const theme = ref<'light' | 'dark'>(initial)
function applyTheme(value: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', value === 'dark')
  document.documentElement.style.colorScheme = value
}
applyTheme(theme.value)
watch(theme, (value) => { applyTheme(value); localStorage.setItem(storageKey, value) })
export function toggleTheme() { theme.value = theme.value === 'dark' ? 'light' : 'dark' }
