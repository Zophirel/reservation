<template>
  <section class="auth-container">
    <div class="auth-card">
      <h2>{{ modeTitle }}</h2>
      <p class="subtitle">Access your reservations anywhere you go.</p>

      <form @submit.prevent="handleSubmit">
        <label>
          Email
          <input v-model="form.email" type="email" autocomplete="email" required placeholder="you@example.com" />
        </label>

        <label v-if="isSignup">
          Full name
          <input v-model="form.name" type="text" autocomplete="name" required placeholder="Jane Doe" />
        </label>

        <label>
          Password
          <input
            v-model="form.password"
            type="password"
            autocomplete="current-password"
            required
            minlength="6"
            placeholder="••••••"
          />
        </label>

        <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

        <button class="submit" type="submit">{{ modeAction }}</button>
      </form>

      <p class="switch-mode">
        <span>{{ modeSwitchPrompt }}</span>
        <button type="button" class="link-button" @click="toggleMode">{{ modeSwitchAction }}</button>
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const isSignup = ref(false);
const errorMessage = ref('');
const form = reactive({
  email: '',
  password: '',
  name: ''
});

const modeTitle = computed(() => (isSignup.value ? 'Create your account' : 'Welcome back'));
const modeAction = computed(() => (isSignup.value ? 'Sign up' : 'Log in'));
const modeSwitchPrompt = computed(() =>
  isSignup.value ? 'Already have an account?' : "Don't have an account yet?"
);
const modeSwitchAction = computed(() => (isSignup.value ? 'Log in instead' : 'Create one'));

function resetError() {
  errorMessage.value = '';
}

function toggleMode() {
  isSignup.value = !isSignup.value;
  resetError();
}

function handleSubmit() {
  resetError();
  try {
    if (isSignup.value) {
      auth.signup(form.email, form.password, form.name);
    } else {
      auth.login(form.email, form.password);
    }
    const redirect = (route.query.redirect as string) || '/calendar';
    router.push(redirect);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to authenticate.';
  }
}
</script>

<style scoped>
.auth-container {
  width: min(420px, 100%);
  margin: 0 auto;
}

.auth-card {
  background: rgba(255, 255, 255, 0.92);
  border-radius: 24px;
  box-shadow: 0 24px 40px rgba(15, 23, 42, 0.1);
  padding: 2.5rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

h2 {
  margin: 0;
  font-size: 1.75rem;
  letter-spacing: -0.015em;
}

.subtitle {
  margin: 0;
  color: #64748b;
}

label {
  display: flex;
  flex-direction: column;
  font-weight: 600;
  color: #334155;
  gap: 0.35rem;
}

input {
  padding: 0.75rem 1rem;
  border: 1px solid rgba(148, 163, 184, 0.7);
  border-radius: 12px;
  font-size: 1rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
}

.error {
  color: #b91c1c;
  margin: 0;
  font-weight: 600;
}

.submit {
  margin-top: 0.5rem;
  padding: 0.9rem 1rem;
  border-radius: 999px;
  border: none;
  font-weight: 700;
  font-size: 1rem;
  color: #fff;
  background: linear-gradient(135deg, #2563eb, #4f46e5);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.submit:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 24px rgba(79, 70, 229, 0.35);
}

.switch-mode {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.4rem;
  color: #475569;
  font-size: 0.95rem;
}

.link-button {
  background: none;
  border: none;
  color: #2563eb;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
  text-decoration-color: transparent;
  transition: text-decoration-color 0.2s ease;
}

.link-button:hover {
  text-decoration-color: #2563eb;
}
</style>
