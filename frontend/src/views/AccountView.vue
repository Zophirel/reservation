<template>
  <section class="account-wrapper" v-if="user">
    <div class="profile-card">
      <div class="avatar">{{ initials }}</div>
      <div class="details">
        <h2>{{ user.name }}</h2>
        <p>{{ user.email }}</p>
        <span v-if="user.timezone" class="timezone">{{ user.timezone }}</span>
      </div>
    </div>

    <form class="form-card" @submit.prevent="saveChanges">
      <h3>Profile details</h3>
      <label>
        Full name
        <input v-model="form.name" type="text" required />
      </label>

      <label>
        Phone number
        <input v-model="form.phone" type="tel" placeholder="+1 555 123 4567" />
      </label>

      <label>
        Preferred timezone
        <select v-model="form.timezone">
          <option disabled value="">Select timezone</option>
          <option v-for="zone in timezones" :key="zone" :value="zone">{{ zone }}</option>
        </select>
      </label>

      <button type="submit" class="primary">Save changes</button>
      <p v-if="showSuccess" class="success">Profile updated successfully!</p>
    </form>

    <section class="reservation-history">
      <h3>Upcoming reservations</h3>
      <p v-if="!reservationSummary.length" class="empty">No reservations saved yet.</p>
      <ul v-else>
        <li v-for="reservation in reservationSummary" :key="reservation.date">
          <h4>{{ formatReservationDate(reservation.date) }}</h4>
          <p>{{ reservation.slots.join(', ') }}</p>
        </li>
      </ul>
    </section>
  </section>
  <section v-else class="account-wrapper">
    <p class="empty">Sign in to view your profile.</p>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '../stores/auth';
import { useReservationStore } from '../stores/reservations';

const auth = useAuthStore();
const reservationStore = useReservationStore();
const { user } = storeToRefs(auth);
const { list: reservationSummary } = storeToRefs(reservationStore);
const showSuccess = ref(false);

const form = reactive({
  name: '',
  phone: '',
  timezone: ''
});

const timezones = [
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Australia/Sydney'
];

watch(
  user,
  (value) => {
    if (!value) return;
    form.name = value.name;
    form.phone = value.phone ?? '';
    form.timezone = value.timezone ?? '';
  },
  { immediate: true }
);

const initials = computed(() => {
  if (!user.value) return '';
  const [first = '', second = ''] = user.value.name.split(' ');
  return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase();
});

function formatReservationDate(dateIso: string) {
  return new Date(dateIso).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });
}

function saveChanges() {
  if (!user.value) return;
  auth.updateProfile({ ...form });
  showSuccess.value = true;
  window.setTimeout(() => {
    showSuccess.value = false;
  }, 2500);
}
</script>

<style scoped>
.account-wrapper {
  width: min(900px, 100%);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 24px;
  padding: 1.75rem 2rem;
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.08);
}

.avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 1.4rem;
  color: #4338ca;
  background: linear-gradient(135deg, #e0e7ff, #ede9fe);
}

.details h2 {
  margin: 0 0 0.2rem;
  font-size: 1.5rem;
}

.details p {
  margin: 0;
  color: #64748b;
}

.timezone {
  display: inline-block;
  margin-top: 0.35rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #2563eb;
  background: rgba(37, 99, 235, 0.1);
  padding: 0.3rem 0.65rem;
  border-radius: 999px;
}

.form-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 24px;
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.08);
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.form-card h3 {
  margin: 0;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-weight: 600;
  color: #334155;
}

input,
select {
  padding: 0.75rem 1rem;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.7);
  font-size: 1rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

input:focus,
select:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
}

.primary {
  align-self: flex-start;
  padding: 0.75rem 1.5rem;
  border-radius: 999px;
  border: none;
  background: linear-gradient(135deg, #2563eb, #4f46e5);
  color: #fff;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 12px 24px rgba(79, 70, 229, 0.28);
}

.success {
  margin: 0;
  color: #15803d;
  font-weight: 600;
}

.reservation-history {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 24px;
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.08);
  padding: 2rem;
}

.reservation-history h3 {
  margin: 0 0 1rem;
}

.reservation-history ul {
  margin: 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.reservation-history h4 {
  margin: 0 0 0.25rem;
}

.empty {
  margin: 0;
  color: #64748b;
  text-align: center;
}

@media (max-width: 640px) {
  .profile-card {
    flex-direction: column;
    text-align: center;
  }

  .primary {
    width: 100%;
    text-align: center;
  }
}
</style>
