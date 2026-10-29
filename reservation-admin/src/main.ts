import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import i18n from './i18n'
import './styles/main.css'
import 'vue-sonner/style.css'

const app = createApp(App)

app.config.errorHandler = (error, _instance, info) => {
  console.error('[reservio:vue-error]', 'unhandled Vue error', { info, error })
}

window.addEventListener('error', (event) => {
  console.error('[reservio:window-error]', 'uncaught window error', {
    message: event.message,
    filename: event.filename,
    line: event.lineno,
    column: event.colno,
    error: event.error,
  })
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('[reservio:unhandled-rejection]', 'unhandled promise rejection', { reason: event.reason })
})

app.use(createPinia()).use(i18n).use(router).mount('#app')
