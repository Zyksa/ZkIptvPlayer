<template>
  <div class="fixed inset-0 z-50 bg-obsidian-950/95 backdrop-blur-xl flex items-center justify-center p-4 select-none">
    <div class="glass-panel max-w-md w-full rounded-3xl p-8 space-y-6 shadow-2xl border border-white/10 relative overflow-hidden">
      <!-- Decorative Glows -->
      <div class="absolute -top-24 -left-24 w-48 h-48 bg-brand-500/20 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute -bottom-24 -right-24 w-48 h-48 bg-brand-accent/20 rounded-full blur-3xl pointer-events-none"></div>

      <!-- App Logo & Title -->
      <div class="text-center space-y-2">
        <img src="@/assets/logo.svg" alt="ZkPlayer Logo" class="w-14 h-14 mx-auto drop-shadow-xl" />
        <h1 class="text-xl font-extrabold text-slate-100 uppercase tracking-wider">
          ZkPlayer <span class="text-brand-accent">DESKTOP</span>
        </h1>
        <p class="text-xs text-slate-400">Connexion IPTV Xtream Codes API ou Lien Playlist M3U</p>
      </div>

      <!-- Auth Mode Tabs (Xtream vs M3U) -->
      <div class="flex bg-obsidian-950 p-1 rounded-2xl border border-white/10">
        <button
          type="button"
          @click="activeMode = 'xtream'"
          :class="[
            'flex-1 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-2',
            activeMode === 'xtream' ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
          ]"
        >
          <Server class="w-3.5 h-3.5" />
          <span>API Xtream Codes</span>
        </button>
        <button
          type="button"
          @click="activeMode = 'm3u'"
          :class="[
            'flex-1 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-2',
            activeMode === 'm3u' ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
          ]"
        >
          <Link class="w-3.5 h-3.5" />
          <span>Lien Playlist M3U</span>
        </button>
      </div>

      <!-- Error Notification -->
      <div v-if="authStore.error" class="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
        <AlertCircle class="w-4 h-4 shrink-0" />
        <span>{{ authStore.error }}</span>
      </div>

      <!-- Xtream Codes Login Form -->
      <form v-if="activeMode === 'xtream'" @submit.prevent="handleXtreamLogin" class="space-y-4">
        <div class="space-y-1">
          <label class="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">URL du Serveur IPTV</label>
          <div class="relative">
            <Globe class="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              v-model="xtreamForm.serverUrl"
              type="text"
              required
              placeholder="http://exemple-iptv.com:8080"
              class="w-full glass-input rounded-xl pl-9 pr-3 py-2.5 text-xs font-mono"
            />
          </div>
        </div>

        <div class="space-y-1">
          <label class="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Identifiant (Username)</label>
          <div class="relative">
            <User class="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              v-model="xtreamForm.username"
              type="text"
              required
              placeholder="Votre identifiant"
              class="w-full glass-input rounded-xl pl-9 pr-3 py-2.5 text-xs font-mono"
            />
          </div>
        </div>

        <div class="space-y-1">
          <label class="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Mot de passe (Password)</label>
          <div class="relative">
            <Lock class="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              v-model="xtreamForm.password"
              type="password"
              required
              placeholder="••••••••••••"
              class="w-full glass-input rounded-xl pl-9 pr-3 py-2.5 text-xs font-mono"
            />
          </div>
        </div>

        <div class="flex items-center justify-between pt-1">
          <label class="flex items-center space-x-2 cursor-pointer text-xs text-slate-300">
            <input type="checkbox" v-model="rememberMe" class="w-4 h-4 accent-brand-accent rounded cursor-pointer" />
            <span>Se souvenir de moi</span>
          </label>
        </div>

        <button
          type="submit"
          :disabled="authStore.isLoading"
          class="w-full py-3 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-bold text-xs shadow-lg shadow-brand-500/30 flex items-center justify-center space-x-2 transition-transform active:scale-[0.99] disabled:opacity-50"
        >
          <LoadingSpinner v-if="authStore.isLoading" compact />
          <span v-else>SE CONNECTER À ZKPLAYER</span>
          <LogIn v-if="!authStore.isLoading" class="w-4 h-4" />
        </button>
      </form>

      <!-- M3U Link Form -->
      <form v-else @submit.prevent="handleM3uLogin" class="space-y-4">
        <div class="space-y-1">
          <label class="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Nom de la Playlist</label>
          <div class="relative">
            <Folder class="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              v-model="m3uForm.name"
              type="text"
              placeholder="Ma Playlist M3U"
              class="w-full glass-input rounded-xl pl-9 pr-3 py-2.5 text-xs font-mono"
            />
          </div>
        </div>

        <div class="space-y-1">
          <label class="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">URL du fichier M3U / M3U8</label>
          <div class="relative">
            <Link class="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              v-model="m3uForm.playlistUrl"
              type="url"
              required
              placeholder="http://exemple.com/playlist.m3u8"
              class="w-full glass-input rounded-xl pl-9 pr-3 py-2.5 text-xs font-mono"
            />
          </div>
        </div>

        <div class="flex items-center justify-between pt-1">
          <label class="flex items-center space-x-2 cursor-pointer text-xs text-slate-300">
            <input type="checkbox" v-model="rememberMe" class="w-4 h-4 accent-brand-accent rounded cursor-pointer" />
            <span>Se souvenir de moi</span>
          </label>
        </div>

        <button
          type="submit"
          :disabled="authStore.isLoading"
          class="w-full py-3 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-bold text-xs shadow-lg shadow-brand-500/30 flex items-center justify-center space-x-2 transition-transform active:scale-[0.99] disabled:opacity-50"
        >
          <LoadingSpinner v-if="authStore.isLoading" compact />
          <span v-else>CHARGER LA PLAYLIST M3U</span>
          <LogIn v-if="!authStore.isLoading" class="w-4 h-4" />
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { Server, Link, Globe, User, Lock, Folder, LogIn, AlertCircle } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useIptvStore } from '@/stores/iptv'
import LoadingSpinner from '@/components/LoadingSpinner.vue'

const authStore = useAuthStore()
const iptvStore = useIptvStore()

const activeMode = ref<'xtream' | 'm3u'>('xtream')
const rememberMe = ref(true)

const xtreamForm = reactive({
  serverUrl: '',
  username: '',
  password: '',
})

const m3uForm = reactive({
  name: 'Ma Playlist M3U',
  playlistUrl: '',
})

const handleXtreamLogin = async () => {
  const success = await authStore.login(
    {
      serverUrl: xtreamForm.serverUrl,
      username: xtreamForm.username,
      password: xtreamForm.password,
    },
    rememberMe.value
  )
  if (success) {
    await iptvStore.loadInitialData()
  }
}

const handleM3uLogin = async () => {
  const success = await authStore.loginM3u(
    {
      playlistUrl: m3uForm.playlistUrl,
      name: m3uForm.name || 'Ma Playlist M3U',
    },
    rememberMe.value
  )
  if (success) {
    await iptvStore.loadInitialData()
  }
}
</script>
