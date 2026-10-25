import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function unwrap({ data, error }) {
  if (error) throw new Error(error.message || 'Помилка запиту до сервера');
  return data;
}

export const api = {
  onAuthStateChange(callback) {
    return supabaseClient.auth.onAuthStateChange(callback);
  },

  async signIn(email, password) {
    return unwrap(await supabaseClient.auth.signInWithPassword({ email, password }));
  },

  async signUp(email, password) {
    return unwrap(await supabaseClient.auth.signUp({ email, password }));
  },

  async signOut() {
    return unwrap(await supabaseClient.auth.signOut());
  },

  async setMyTimezone(tz) {
    return unwrap(await supabaseClient.rpc('set_my_timezone', { tz }));
  },

  async getMyStatus() {
    return unwrap(await supabaseClient.rpc('get_my_status'));
  },

  async getPairStatus() {
    return unwrap(await supabaseClient.rpc('get_pair_status'));
  },

  async updateProfileFields(userId, fields) {
    // Дозволені поля на бекенді: gym_lat, gym_lng, is_test_mode, display_name
    const { error } = await supabaseClient
      .from('profiles')
      .update(fields)
      .eq('id', userId);
    if (error) throw new Error(error.message);
    return true;
  },

  async setWeeklyGoal(newGoal) {
    return unwrap(await supabaseClient.rpc('set_weekly_goal', { new_goal: newGoal }));
  },

  async startWorkout(lat, lng, accuracy) {
    return unwrap(
      await supabaseClient.rpc('start_workout', {
        user_lat: lat,
        user_lng: lng,
        user_accuracy: accuracy
      })
    );
  },

  async finishWorkout(lat, lng, accuracy) {
    return unwrap(
      await supabaseClient.rpc('finish_workout', {
        user_lat: lat,
        user_lng: lng,
        user_accuracy: accuracy
      })
    );
  },

  async abandonWorkout() {
    return unwrap(await supabaseClient.rpc('abandon_workout'));
  },

  async createInvite() {
    return unwrap(await supabaseClient.rpc('create_invite'));
  },

  async acceptInvite(code) {
    return unwrap(await supabaseClient.rpc('accept_invite', { code }));
  },

  async leavePair() {
    return unwrap(await supabaseClient.rpc('leave_pair'));
  },

  async restorePair() {
    return unwrap(await supabaseClient.rpc('restore_pair'));
  },

  // Dev RPC
  async devShiftTime(days) {
    return unwrap(await supabaseClient.rpc('dev_shift_time', { days }));
  },

  async devAddWorkout(date) {
    return unwrap(await supabaseClient.rpc('dev_add_workout', { date }));
  },

  async devClearMyData() {
    return unwrap(await supabaseClient.rpc('dev_clear_my_data'));
  },

  async devSetScenario(name) {
    return unwrap(await supabaseClient.rpc('dev_set_scenario', { name }));
  },

  async devCreateFakePartner() {
    return unwrap(await supabaseClient.rpc('dev_create_fake_partner'));
  },

  async devSetFakePartner(daysDone, goal, streak) {
    return unwrap(
      await supabaseClient.rpc('dev_set_fake_partner', {
        days_done: daysDone,
        goal,
        streak
      })
    );
  },

  async devRemoveFakePartner() {
    return unwrap(await supabaseClient.rpc('dev_remove_fake_partner'));
  }
};

export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Твій браузер не підтримує геолокацію'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      (err) => {
        if (err.code === 1) {
          reject(new Error('Дозволь доступ до геолокації в налаштуваннях браузера'));
        } else {
          reject(new Error('Не вдалося отримати GPS-сигнал. Спробуй ще раз'));
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}