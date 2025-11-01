<template>
  <div class="app-shell">
    <header class="app-header">
      <h1>Reservely</h1>
      <button v-if="auth.isAuthenticated" class="logout" type="button" @click="handleLogout">
        Log out
      </button>
    </header>

    <main class="app-main">
      <RouterView />
    </main>

    <nav v-if="auth.isAuthenticated" class="app-nav">
      <RouterLink to="/calendar" class="nav-link" :class="{ active: isActive('/calendar') }">
        📅
        <span>Calendar</span>
      </RouterLink>
      <RouterLink to="/account" class="nav-link" :class="{ active: isActive('/account') }">
        👤
        <span>Account</span>
      </RouterLink>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from './stores/auth';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const isActive = (path: string) => route.path === path;

function handleLogout() {
  auth.logout();
  router.push({ name: 'login' });
}
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #f5f7fb 0%, #ffffff 50%, #f0f4ff 100%);
  color: #1f2933;
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: rgba(255, 255, 255, 0.85);
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(12px);
}

.app-header h1 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.logout {
  background: #f56565;
  color: #fff;
  border: none;
  border-radius: 999px;
  padding: 0.5rem 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.logout:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(245, 101, 101, 0.35);
}

.app-main {
  flex: 1;
  padding: 1.5rem;
  display: flex;
  justify-content: center;
  align-items: center;
}

.app-nav {
  display: flex;
  justify-content: space-around;
  padding: 0.75rem 1.5rem;
  background: rgba(255, 255, 255, 0.92);
  border-top: 1px solid rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(12px);
}

.nav-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  text-decoration: none;
  color: #52606d;
  font-weight: 600;
  transition: color 0.2s ease;
}

.nav-link span {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.nav-link.active {
  color: #2563eb;
}
</style>
