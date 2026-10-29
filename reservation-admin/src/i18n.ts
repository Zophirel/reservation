import { createI18n } from 'vue-i18n'
import en from './locales/en'
import it from './locales/it'

export type AppLocale = 'it' | 'en'
const storageKey = 'reservio-admin-locale'
const saved = localStorage.getItem(storageKey)
const locale: AppLocale = saved === 'it' || saved === 'en' ? saved : navigator.language.toLowerCase().startsWith('it') ? 'it' : 'en'
document.documentElement.lang = locale

export const i18n = createI18n({ legacy: false, locale, fallbackLocale: 'en', messages: { en, it } })
export function setLocale(value: AppLocale) {
  i18n.global.locale.value = value
  localStorage.setItem(storageKey, value)
  document.documentElement.lang = value
}
export default i18n
