<template>
  <div class="app-shell w-screen h-screen flex flex-col bg-obsidian-950 text-slate-100 overflow-hidden font-sans select-none">
    <!-- Windows Frameless Custom Titlebar -->
    <Titlebar />

    <!-- Loading Splash during auto-login session restore -->
    <div v-if="authStore.isAutoLoggingIn" class="flex-1 flex flex-col items-center justify-center bg-obsidian-950 space-y-4">
      <img src="@/assets/logo.svg" alt="ZkPlayer Logo" class="w-16 h-16 animate-pulse-subtle drop-shadow-[0_0_24px_rgba(56,189,248,0.25)]" />
      <LoadingSpinner label="Restauration de votre session" />
    </div>

    <!-- Login Modal if not authenticated -->
    <LoginModal v-else-if="!authStore.isAuthenticated" />

    <!-- Main Application Shell -->
    <div v-else class="flex-1 flex overflow-hidden relative">
      <!-- Left Sidebar Navigation -->
      <Sidebar />

      <!-- Active Content View -->
      <main class="flex-1 bg-obsidian-950/60 overflow-hidden relative">
        <Transition name="view" mode="out-in">
          <component :is="activeViewComponent" :key="iptvStore.currentView" />
        </Transition>
      </main>

      <!-- Video Player Fullscreen Overlay -->
      <VideoPlayer v-if="playerStore.currentMedia" />

      <!-- FFmpeg auto-download modal -->
      <FfmpegDownloadModal />
    </div>

    <!-- Auto Updater Notification Modal
         Mounted at top level (not gated behind authentication) so the update
         check runs at startup regardless of login state. Overlay is fixed/z-50. -->
    <UpdateModal />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted } from 'vue'
import Titlebar from '@/components/Titlebar.vue'
import Sidebar from '@/components/Sidebar.vue'
import LoginModal from '@/components/LoginModal.vue'
import UpdateModal from '@/components/UpdateModal.vue'
import FfmpegDownloadModal from '@/components/FfmpegDownloadModal.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'

import { useAuthStore } from '@/stores/auth'
import { useIptvStore } from '@/stores/iptv'
import { usePlayerStore } from '@/stores/player'

const HomeView = defineAsyncComponent(() => import('@/components/HomeView.vue'))
const LiveTvView = defineAsyncComponent(() => import('@/components/LiveTvView.vue'))
const MoviesView = defineAsyncComponent(() => import('@/components/MoviesView.vue'))
const SeriesView = defineAsyncComponent(() => import('@/components/SeriesView.vue'))
const SearchView = defineAsyncComponent(() => import('@/components/SearchView.vue'))
const FavoritesView = defineAsyncComponent(() => import('@/components/FavoritesView.vue'))
const SettingsView = defineAsyncComponent(() => import('@/components/SettingsView.vue'))
const VideoPlayer = defineAsyncComponent(() => import('@/components/VideoPlayer.vue'))

const authStore = useAuthStore()
const iptvStore = useIptvStore()
const playerStore = usePlayerStore()

const activeViewComponent = computed(() => ({
  home: HomeView,
  live: LiveTvView,
  movies: MoviesView,
  series: SeriesView,
  search: SearchView,
  favorites: FavoritesView,
  settings: SettingsView,
})[iptvStore.currentView])

onMounted(async () => {
  await authStore.initSession()
  if (authStore.isAuthenticated) {
    // Load catalogue in the background so the shell renders instantly.
    iptvStore.loadInitialData()
  }
})
</script>
