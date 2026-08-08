<template>
  <div class="h-full flex flex-col p-6 gap-6 overflow-y-auto">
    <section class="home-hero rounded-2xl p-6 border border-white/10">
      <div class="relative z-10 flex flex-col gap-5">
        <div class="space-y-2">
          <div class="inline-flex items-center px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono text-brand-accent">
            VERSION {{ appVersion }}
          </div>
          <h1 class="text-2xl font-bold text-slate-100 tracking-tight">
            ZkPlayer <span class="text-brand-accent">Desktop</span>
          </h1>
          <p class="text-xs text-slate-400">Tout votre contenu, simplement.</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl">
          <button
            v-for="stat in catalogStats"
            :key="stat.view"
            type="button"
            @click="iptvStore.currentView = stat.view"
            class="home-stat group flex items-center gap-3 p-3 rounded-xl text-left"
          >
            <span class="w-9 h-9 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-accent shrink-0">
              <component :is="stat.icon" class="w-4 h-4" />
            </span>
            <span class="min-w-0">
              <strong class="block text-base leading-none text-slate-100 font-mono">{{ formatCount(stat.count) }}</strong>
              <span class="block mt-1 text-[10px] uppercase tracking-wider text-slate-400">{{ stat.label }}</span>
            </span>
          </button>
        </div>
      </div>
    </section>

    <!-- Continue Watching Quick Section -->
    <div v-if="iptvStore.continueWatching.length > 0" class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
          <PlayCircle class="w-3.5 h-3.5 text-brand-accent" />
          <span>Reprendre la lecture</span>
        </h2>
        <button
          type="button"
          @click="iptvStore.currentView = 'favorites'"
          class="text-xs text-brand-accent hover:underline flex items-center space-x-1"
        >
          <span>Voir historique</span>
          <ChevronRight class="w-3.5 h-3.5" />
        </button>
      </div>

      <div class="stagger-grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        <div
          v-for="item in iptvStore.continueWatching.slice(0, 4)"
          :key="item.id"
          @click="resumeWatch(item)"
          class="glass-card p-3 rounded-lg cursor-pointer group space-y-2.5 relative"
        >
          <FavoriteButton
            :media="item.media"
            class="absolute top-2 right-2 z-10"
          />
          <div class="flex items-center space-x-3">
            <div class="w-10 h-14 rounded bg-obsidian-950 border border-white/10 overflow-hidden shrink-0">
              <img
                v-if="isSafeImageUrl(item.media.poster || item.media.icon)"
                :src="item.media.poster || item.media.icon"
                :alt="item.media.title"
                class="w-full h-full object-cover"
                loading="lazy"
                referrerpolicy="no-referrer"
              />
            </div>
            <div class="overflow-hidden flex-1">
              <h3 class="content-title text-xs font-medium text-slate-200 truncate">{{ item.media.title }}</h3>
              <span class="text-[9px] uppercase font-mono text-slate-500">{{ item.media.type }}</span>
            </div>
          </div>

          <div class="space-y-1">
            <div class="w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                class="h-full bg-brand-accent rounded-full"
                :style="{ width: `${Math.min(100, (item.currentTime / (item.duration || 1)) * 100)}%` }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="space-y-3">
      <h2 class="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
        <Compass class="w-3.5 h-3.5 text-sky-400" />
        <span>Navigation Rapide</span>
      </h2>

      <div class="stagger-grid grid grid-cols-1 md:grid-cols-3 gap-3">
        <div
          @click="iptvStore.currentView = 'live'"
          class="glass-panel hover-lift p-5 rounded-lg cursor-pointer group hover:border-brand-500/50 transition-all space-y-2"
        >
          <div class="w-9 h-9 rounded bg-brand-600/20 text-brand-accent border border-brand-500/30 flex items-center justify-center">
            <Tv class="w-5 h-5" />
          </div>
          <div>
            <h3 class="content-title text-sm font-bold text-slate-100 flex items-center justify-between">
              <span>Direct TV</span>
              <ChevronRight class="w-4 h-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
            </h3>
            <p class="text-xs text-slate-400 mt-1">Regarder vos chaînes.</p>
          </div>
        </div>

        <div
          @click="iptvStore.currentView = 'movies'"
          class="glass-panel hover-lift p-5 rounded-lg cursor-pointer group hover:border-brand-500/50 transition-all space-y-2"
        >
          <div class="w-9 h-9 rounded bg-brand-600/20 text-brand-accent border border-brand-500/30 flex items-center justify-center">
            <Film class="w-5 h-5" />
          </div>
          <div>
            <h3 class="content-title text-sm font-bold text-slate-100 flex items-center justify-between">
              <span>Films VOD</span>
              <ChevronRight class="w-4 h-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
            </h3>
            <p class="text-xs text-slate-400 mt-1">Parcourir tous vos films.</p>
          </div>
        </div>

        <div
          @click="iptvStore.currentView = 'series'"
          class="glass-panel hover-lift p-5 rounded-lg cursor-pointer group hover:border-brand-500/50 transition-all space-y-2"
        >
          <div class="w-9 h-9 rounded bg-brand-600/20 text-brand-accent border border-brand-500/30 flex items-center justify-center">
            <Clapperboard class="w-5 h-5" />
          </div>
          <div>
            <h3 class="content-title text-sm font-bold text-slate-100 flex items-center justify-between">
              <span>Séries TV</span>
              <ChevronRight class="w-4 h-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
            </h3>
            <p class="text-xs text-slate-400 mt-1">Retrouver vos séries.</p>
          </div>
        </div>
      </div>
    </div>

    <footer class="mt-auto pt-2 pb-1 text-center">
      <a
        href="https://zyksa.dev"
        target="_blank"
        rel="noopener noreferrer"
        @click.prevent="openZyksaWebsite"
        class="developer-link inline-flex items-center gap-1.5 text-[11px] font-medium"
        title="Visiter zyksa.dev"
      >
        <span>Développé par</span>
        <strong>Zyksa</strong>
      </a>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Tv, Film, Clapperboard, PlayCircle, ChevronRight, Compass } from 'lucide-vue-next'
import packageJson from '../../package.json'
import type { ContinueWatchingItem } from '@/types/iptv'
import { useIptvStore } from '@/stores/iptv'
import { usePlayerStore } from '@/stores/player'
import { openExternalUrl } from '@/services/tauri'
import { isSafeImageUrl } from '@/utils/url'
import FavoriteButton from '@/components/FavoriteButton.vue'

const iptvStore = useIptvStore()
const playerStore = usePlayerStore()
const appVersion = packageJson.version

const catalogStats = computed(() => [
  { view: 'live' as const, label: 'Chaînes TV', count: iptvStore.allLiveChannels.length, icon: Tv },
  { view: 'movies' as const, label: 'Films', count: iptvStore.allVodMovies.length, icon: Film },
  { view: 'series' as const, label: 'Séries', count: iptvStore.allSeriesList.length, icon: Clapperboard },
])

const formatCount = (count: number) => new Intl.NumberFormat('fr-FR').format(count)
const openZyksaWebsite = () => openExternalUrl('https://zyksa.dev')

const resumeWatch = (item: ContinueWatchingItem) => {
  playerStore.playMedia(item.media)
  playerStore.seekTo(item.currentTime)
}
</script>
