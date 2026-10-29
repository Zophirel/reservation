import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({ history: createWebHistory(import.meta.env.BASE_URL), routes: [
  { path: '/login', component: () => import('@/views/LoginView.vue'), meta: { guest: true } },
  { path: '/', component: () => import('@/components/layout/AdminLayout.vue'), meta: { admin: true }, children: [
    { path: '', component: () => import('@/views/admin/DashboardView.vue') },
    { path: 'reservations', component: () => import('@/views/admin/ReservationsView.vue') },
    { path: 'availability', component: () => import('@/views/admin/AvailabilityView.vue') },
    { path: 'services', component: () => import('@/views/admin/ServicesView.vue') },
    { path: 'invitations', component: () => import('@/views/admin/InvitationsView.vue') },
    { path: 'users', component: () => import('@/views/admin/UsersView.vue') },
    { path: 'contacts', component: () => import('@/views/admin/ContactsView.vue') },
    { path: 'settings', component: () => import('@/views/admin/SettingsView.vue') },
  ] },
  { path: '/:pathMatch(.*)*', redirect: '/' },
] })
router.beforeEach((to) => { let session: { user?: { role?: string } } | null = null; try { session = JSON.parse(localStorage.getItem('reservio-admin-session') || 'null') } catch { /* empty */ } const admin = session?.user?.role === 'ADMIN'; if (to.meta.admin && !admin) return '/login'; if (to.meta.guest && admin) return '/' })
export default router
