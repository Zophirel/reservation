import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/book' },
    { path: '/auth', component: () => import('@/views/AuthView.vue'), meta: { guest: true } },
    { path: '/invite/:token', component: () => import('@/views/InviteView.vue'), meta: { guest: true } },
    { path: '/book', component: () => import('@/views/BookingView.vue'), meta: { auth: true } },
    { path: '/account', component: () => import('@/views/AccountView.vue'), meta: { auth: true } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach((to) => {
  let session: { user?: { role?: string } } | null = null
  try { session = JSON.parse(localStorage.getItem('reservio-session') || 'null') } catch { /* empty */ }
  if (to.meta.auth && !session?.user) return '/auth'
  if (to.meta.guest && session?.user) return '/book'
})

export default router
