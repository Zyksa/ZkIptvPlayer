<template>
  <aside class="w-60 bg-obsidian-900 border-r border-white/10 flex flex-col justify-between select-none z-40">
    <!-- Top Navigation Menu -->
    <div class="p-3 space-y-4">
      <!-- Search Input & Refresh Button Row -->
      <div class="space-y-2">
        <SearchInput
          v-model="iptvStore.searchQuery"
          placeholder="Rechercher un contenu..."
        />

        <!-- Refresh Content Button -->
        <button
          type="button"
          @click="iptvStore.refreshContent()"
          :disabled="iptvStore.isLoadingData"
          class="w-full flex items-center justify-center space-x-2 px-3 py-1.5 rounded-md text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition-colors disabled:opacity-50"
          title="Mettre à jour le catalogue depuis le serveur IPTV"
        >
          <RotateCw :class="['w-3.5 h-3.5 text-brand-accent', iptvStore.isLoadingData ? 'animate-spin' : '']" />
          <span>{{ iptvStore.isLoadingData ? 'Actualisation...' : 'Actualiser le catalogue' }}</span>
        </button>
      </div>

      <!-- Professional Linear Indeterminate Progress Bar Loader -->
      <div v-if="iptvStore.isLoadingData" class="loader-bar-container rounded-sm">
        <div class="loader-bar-indeterminate"></div>
      </div>

      <!-- Navigation Links -->
      <nav class="space-y-0.5">
        <button
          type="button"
          @click="iptvStore.currentView = 'home'"
          :class="[
            'w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors',
            iptvStore.currentView === 'home'
              ? 'bg-brand-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
          ]"
        >
          <div class="flex items-center space-x-2.5">
            <Home class="w-4 h-4" />
            <span>Accueil</span>
          </div>
        </button>

        <button
          type="button"
          @click="iptvStore.currentView = 'live'"
          :class="[
            'w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors',
            iptvStore.currentView === 'live'
              ? 'bg-brand-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
          ]"
        >
          <div class="flex items-center space-x-2.5">
            <Tv class="w-4 h-4" />
            <span>Direct TV</span>
          </div>
          <span
            v-if="iptvStore.allLiveChannels.length"
            class="text-[10px] px-1.5 py-0.2 rounded bg-black/40 text-slate-300 font-mono"
          >
            {{ iptvStore.allLiveChannels.length }}
          </span>
        </button>

        <button
          type="button"
          @click="iptvStore.currentView = 'movies'"
          :class="[
            'w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors',
            iptvStore.currentView === 'movies'
              ? 'bg-brand-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
          ]"
        >
          <div class="flex items-center space-x-2.5">
            <Film class="w-4 h-4" />
            <span>Films VOD</span>
          </div>
          <span
            v-if="iptvStore.allVodMovies.length"
            class="text-[10px] px-1.5 py-0.2 rounded bg-black/40 text-slate-300 font-mono"
          >
            {{ iptvStore.allVodMovies.length }}
          </span>
        </button>

        <button
          type="button"
          @click="iptvStore.currentView = 'series'"
          :class="[
            'w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors',
            iptvStore.currentView === 'series'
              ? 'bg-brand-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
          ]"
        >
          <div class="flex items-center space-x-2.5">
            <Clapperboard class="w-4 h-4" />
            <span>Séries</span>
          </div>
          <span
            v-if="iptvStore.allSeriesList.length"
            class="text-[10px] px-1.5 py-0.2 rounded bg-black/40 text-slate-300 font-mono"
          >
            {{ iptvStore.allSeriesList.length }}
          </span>
        </button>

        <button
          type="button"
          @click="iptvStore.currentView = 'favorites'"
          :class="[
            'w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors',
            iptvStore.currentView === 'favorites'
              ? 'bg-brand-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
          ]"
        >
          <div class="flex items-center space-x-2.5">
            <Heart class="w-4 h-4" />
            <span>Favoris & Reprendre</span>
          </div>
          <span
            v-if="iptvStore.favorites.length"
            class="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono"
          >
            {{ iptvStore.favorites.length }}
          </span>
        </button>

        <button
          type="button"
          @click="iptvStore.currentView = 'settings'"
          :class="[
            'w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors',
            iptvStore.currentView === 'settings'
              ? 'bg-brand-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
          ]"
        >
          <div class="flex items-center space-x-2.5">
            <SlidersHorizontal class="w-4 h-4" />
            <span>Paramètres</span>
          </div>
        </button>
      </nav>
    </div>

    <!-- Bottom User Profile Card -->
    <div class="p-3 border-t border-white/10 bg-obsidian-950/60">
      <div v-if="authStore.userInfo || authStore.m3uCredentials" class="flex items-center justify-between p-2 rounded-md bg-white/5 border border-white/5">
        <div class="flex items-center space-x-2 overflow-hidden">
          <div class="w-7 h-7 rounded bg-brand-600 flex items-center justify-center font-bold text-xs text-white shrink-0">
            {{ (authStore.userInfo?.username || authStore.m3uCredentials?.name || 'ZK').substring(0, 2).toUpperCase() }}
          </div>
          <div class="overflow-hidden text-left">
            <p class="text-xs font-medium text-slate-200 truncate">
              {{ authStore.userInfo?.username || authStore.m3uCredentials?.name || 'Playlist M3U' }}
            </p>
            <p class="text-[9px] text-emerald-400 font-mono truncate uppercase">
              {{ authStore.authMode === 'm3u' ? 'Playlist M3U' : 'Xtream Actif' }}
            </p>
          </div>
        </div>
        <button
          type="button"
          @click="authStore.logout()"
          title="Déconnexion"
          class="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
        >
          <LogOut class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { Home, Tv, Film, Clapperboard, Heart, SlidersHorizontal, LogOut, RotateCw } from 'lucide-vue-next'
import { useIptvStore } from '@/stores/iptv'
import { useAuthStore } from '@/stores/auth'
import SearchInput from '@/components/SearchInput.vue'

const iptvStore = useIptvStore()
const authStore = useAuthStore()
</script>
