<template>
  <div class="h-full flex flex-col p-6 space-y-6 overflow-y-auto">
    <!-- Header Title -->
    <div>
      <h1 class="text-xl font-bold text-slate-100 flex items-center space-x-2">
        <Heart class="w-6 h-6 text-rose-500" />
        <span>Favoris & Reprendre la Lecture</span>
      </h1>
      <p class="text-xs text-slate-400 mt-1">Vos médias enregistrés et votre progression de lecture sauvegardée.</p>
    </div>

    <!-- Continue Watching Section -->
    <div class="space-y-3">
      <h2 class="text-sm font-bold text-slate-200 flex items-center space-x-2">
        <PlayCircle class="w-4 h-4 text-brand-accent" />
        <span>Continuer la lecture</span>
      </h2>

      <div v-if="iptvStore.continueWatching.length === 0" class="p-6 rounded-2xl bg-obsidian-900/60 border border-white/5 text-center text-slate-500 text-xs">
        Aucune lecture en cours. Lancez un film ou une série pour retrouver votre progression ici.
      </div>

      <div v-else class="stagger-grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        <div
          v-for="item in iptvStore.continueWatching"
          :key="item.id"
          @click="resumeWatch(item)"
          class="glass-card p-3 rounded-2xl cursor-pointer group space-y-3"
        >
          <div class="flex items-center space-x-3">
            <div class="w-12 h-16 rounded-xl bg-obsidian-950 border border-white/10 overflow-hidden shrink-0">
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
              <h3 class="content-title text-xs font-semibold text-slate-200 truncate">
                {{ item.media.title }}
              </h3>
              <p class="text-[10px] text-slate-400 font-mono mt-0.5 uppercase">{{ item.media.type }}</p>
            </div>
          </div>

          <!-- Progress Bar -->
          <div class="space-y-1">
            <div class="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                class="h-full bg-brand-accent rounded-full"
                :style="{ width: `${Math.min(100, (item.currentTime / (item.duration || 1)) * 100)}%` }"
              ></div>
            </div>
            <div class="flex justify-between text-[9px] font-mono text-slate-500">
              <span>{{ formatTime(item.currentTime) }}</span>
              <span>{{ formatTime(item.duration) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Favorites Grid -->
    <div class="space-y-3">
      <h2 class="text-sm font-bold text-slate-200 flex items-center space-x-2">
        <Heart class="w-4 h-4 text-rose-400" />
        <span>Mes Favoris ({{ iptvStore.favorites.length }})</span>
      </h2>

      <div v-if="iptvStore.favorites.length === 0" class="p-6 rounded-2xl bg-obsidian-900/60 border border-white/5 text-center text-slate-500 text-xs">
        Aucun favori enregistré. Cliquez sur le cœur d'une carte pour ajouter un contenu.
      </div>

      <div v-else class="stagger-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        <div
          v-for="fav in iptvStore.favorites"
          :key="fav.id"
          @click="openFavorite(fav)"
          class="glass-card rounded-2xl overflow-hidden cursor-pointer group flex flex-col relative"
        >
          <div class="relative aspect-[2/3] bg-obsidian-950 overflow-hidden">
            <img
              v-if="isSafeImageUrl(fav.poster || fav.icon)"
              :src="fav.poster || fav.icon"
              :alt="fav.title"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform"
              loading="lazy"
              referrerpolicy="no-referrer"
            />
            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div class="w-10 h-10 rounded-full bg-brand-500 text-white flex items-center justify-center shadow-lg">
                <Play class="w-5 h-5 ml-0.5" />
              </div>
            </div>
          </div>

          <div class="p-3 flex items-center justify-between">
            <div class="overflow-hidden">
              <h3 class="content-title text-xs font-semibold text-slate-200 truncate">{{ fav.title }}</h3>
              <span class="text-[9px] uppercase font-mono text-slate-500">{{ fav.type }}</span>
            </div>
            <button type="button" @click.prevent.stop="iptvStore.toggleFavorite(fav)" class="text-rose-400 p-1 hover:bg-rose-500/10 rounded-lg">
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Heart, PlayCircle, Play, Trash2 } from 'lucide-vue-next'
import type { ContinueWatchingItem, PlayableMedia } from '@/types/iptv'
import { useIptvStore } from '@/stores/iptv'
import { usePlayerStore } from '@/stores/player'
import { isSafeImageUrl } from '@/utils/url'

const iptvStore = useIptvStore()
const playerStore = usePlayerStore()

const openFavorite = (media: PlayableMedia) => {
  if (media.type === 'series' && !media.streamUrl) {
    iptvStore.seriesSearch = media.title
    iptvStore.currentView = 'series'
    return
  }
  playerStore.playMedia(media)
}

const resumeWatch = (item: ContinueWatchingItem) => {
  playerStore.playMedia(item.media)
  playerStore.seekTo(item.currentTime)
}

const formatTime = (secs: number): string => {
  if (isNaN(secs) || secs < 0) return '00:00'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}
</script>
