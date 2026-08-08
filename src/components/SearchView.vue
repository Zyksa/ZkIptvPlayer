<template>
  <div class="h-full flex flex-col p-6 space-y-5 overflow-y-auto">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="space-y-1">
        <h1 class="text-lg font-bold text-slate-100 flex items-center space-x-2">
          <Search class="w-5 h-5 text-brand-accent" />
          <span>Résultats de recherche</span>
        </h1>
        <p v-if="query" class="text-xs text-slate-400">
          Recherche globale :
          <span class="text-brand-accent font-medium">{{ query }}</span>
        </p>
      </div>
      <button
        v-if="query"
        type="button"
        @click="clearSearch"
        class="px-3 py-1.5 rounded-md text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors"
      >
        Effacer
      </button>
    </div>

    <div v-if="iptvStore.isLoadingData" class="py-8 flex justify-center">
      <LoadingSpinner label="Recherche dans le catalogue" />
    </div>

    <!-- No results -->
    <div
      v-if="!hasAnyResults && !iptvStore.isLoadingData"
      class="flex flex-col items-center justify-center h-64 text-slate-500"
    >
      <SearchX class="w-12 h-12 stroke-1 text-slate-600 mb-3" />
      <p class="text-sm font-medium">Aucun résultat trouvé.</p>
      <p class="text-xs text-slate-500 mt-1">Essayez un autre terme ou vérifiez votre connexion.</p>
    </div>

    <!-- Live TV Section -->
    <section v-if="liveResults.length > 0">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center space-x-2">
          <Tv class="w-4 h-4 text-brand-accent" />
          <h2 class="text-sm font-bold text-slate-200">Direct TV</h2>
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-black/40 text-slate-300 font-mono">{{ liveResults.length }}</span>
        </div>
        <button
          type="button"
          @click="iptvStore.currentView = 'live'"
          class="text-xs text-brand-accent hover:underline flex items-center space-x-1"
        >
          <span>Voir tout</span>
          <ChevronRight class="w-3.5 h-3.5" />
        </button>
      </div>

      <div class="stagger-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        <div
          v-for="channel in liveResults.slice(0, 12)"
          :key="channel.stream_id"
          @click="playChannel(channel)"
          class="glass-card p-3 rounded-lg cursor-pointer flex flex-col justify-between space-y-2 group border border-white/5 hover:border-brand-500/50 transition-all relative"
        >
          <FavoriteButton
            :media="channelPlayable(channel)"
            class="absolute top-2 right-2 z-10"
          />
          <div class="flex items-start space-x-2 overflow-hidden">
            <div class="w-10 h-10 rounded-lg bg-obsidian-950 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center p-1">
              <img
                v-if="isSafeImageUrl(channel.stream_icon)"
                :src="channel.stream_icon"
                :alt="channel.name"
                class="w-full h-full object-contain"
                loading="lazy"
                referrerpolicy="no-referrer"
                @error="onImgError"
              />
              <Tv v-else class="w-5 h-5 text-slate-500" />
            </div>
            <div class="overflow-hidden min-w-0">
              <h3
                :title="channel.name"
                class="content-title text-xs font-medium text-slate-200 line-clamp-2 leading-snug"
              >
                {{ channel.name }}
              </h3>
            </div>
          </div>

          <button
            type="button"
            @click.prevent.stop="playChannel(channel)"
            class="w-full py-1.5 rounded bg-brand-600 hover:bg-brand-500 text-white text-[10px] font-medium flex items-center justify-center space-x-1 shadow transition-colors"
          >
            <Play class="w-3 h-3 fill-current" />
            <span>Regarder</span>
          </button>
        </div>
      </div>
    </section>

    <!-- Movies Section -->
    <section v-if="movieResults.length > 0">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center space-x-2">
          <Film class="w-4 h-4 text-brand-accent" />
          <h2 class="text-sm font-bold text-slate-200">Films VOD</h2>
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-black/40 text-slate-300 font-mono">{{ movieResults.length }}</span>
        </div>
        <button
          type="button"
          @click="iptvStore.currentView = 'movies'"
          class="text-xs text-brand-accent hover:underline flex items-center space-x-1"
        >
          <span>Voir tout</span>
          <ChevronRight class="w-3.5 h-3.5" />
        </button>
      </div>

      <div class="stagger-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        <div
          v-for="movie in movieResults.slice(0, 12)"
          :key="movie.stream_id"
          @click="openMovie(movie)"
          class="glass-card rounded-md overflow-hidden cursor-pointer group flex flex-col"
        >
          <div class="relative aspect-[2/3] bg-obsidian-950 overflow-hidden">
            <img
              v-if="isSafeImageUrl(movie.stream_icon)"
              :src="movie.stream_icon"
              :alt="movie.name"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              loading="lazy"
              referrerpolicy="no-referrer"
              @error="onImgError"
            />
            <div v-else class="w-full h-full flex items-center justify-center text-slate-600">
              <Film class="w-8 h-8 stroke-1" />
            </div>

            <div v-if="movie.rating" class="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-bold text-amber-400 flex items-center space-x-1 border border-white/10 font-mono">
              <Star class="w-3 h-3 fill-current" />
              <span>{{ Number(movie.rating).toFixed(1) }}</span>
            </div>

            <FavoriteButton
              :media="moviePlayable(movie)"
              class="absolute top-1.5 left-1.5 z-10"
            />

            <div v-if="loadingMovieId === movie.stream_id" class="absolute inset-0 z-30 bg-black/65 backdrop-blur-sm flex items-center justify-center">
              <LoadingSpinner compact label="Ouverture" />
            </div>

            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div class="w-10 h-10 rounded-full bg-brand-600 text-white flex items-center justify-center shadow-lg">
                <Play class="w-5 h-5 ml-0.5 fill-current" />
              </div>
            </div>
          </div>

          <div class="p-2.5">
            <h3
              :title="movie.name"
              class="content-title text-xs font-medium text-slate-200 line-clamp-2 leading-snug"
            >
              {{ movie.name }}
            </h3>
          </div>
        </div>
      </div>
    </section>

    <!-- Series Section -->
    <section v-if="seriesResults.length > 0">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center space-x-2">
          <Clapperboard class="w-4 h-4 text-brand-accent" />
          <h2 class="text-sm font-bold text-slate-200">Séries</h2>
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-black/40 text-slate-300 font-mono">{{ seriesResults.length }}</span>
        </div>
        <button
          type="button"
          @click="iptvStore.currentView = 'series'"
          class="text-xs text-brand-accent hover:underline flex items-center space-x-1"
        >
          <span>Voir tout</span>
          <ChevronRight class="w-3.5 h-3.5" />
        </button>
      </div>

      <div class="stagger-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        <div
          v-for="series in seriesResults.slice(0, 12)"
          :key="series.series_id"
          @click="openSeries(series)"
          class="glass-card rounded-md overflow-hidden cursor-pointer group flex flex-col"
        >
          <div class="relative aspect-[2/3] bg-obsidian-950 overflow-hidden">
            <img
              v-if="isSafeImageUrl(series.cover)"
              :src="series.cover"
              :alt="series.name"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              loading="lazy"
              referrerpolicy="no-referrer"
              @error="onImgError"
            />
            <div v-else class="w-full h-full flex items-center justify-center text-slate-600">
              <Clapperboard class="w-8 h-8 stroke-1" />
            </div>

            <div v-if="series.rating" class="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-bold text-amber-400 flex items-center space-x-1 border border-white/10 font-mono">
              <Star class="w-3 h-3 fill-current" />
              <span>{{ Number(series.rating).toFixed(1) }}</span>
            </div>

            <FavoriteButton
              :media="seriesFavorite(series)"
              class="absolute top-1.5 left-1.5 z-10"
            />

            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div class="w-10 h-10 rounded-full bg-brand-600 text-white flex items-center justify-center shadow-lg">
                <Play class="w-5 h-5 ml-0.5 fill-current" />
              </div>
            </div>
          </div>

          <div class="p-2.5">
            <h3
              :title="series.name"
              class="content-title text-xs font-medium text-slate-200 line-clamp-2 leading-snug"
            >
              {{ series.name }}
            </h3>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search, SearchX, Tv, Film, Clapperboard, Play, Star, ChevronRight } from 'lucide-vue-next'
import type { LiveChannel, Movie, Series, PlayableMedia } from '@/types/iptv'
import { useIptvStore } from '@/stores/iptv'
import { useAuthStore } from '@/stores/auth'
import { usePlayerStore } from '@/stores/player'
import { XtreamService } from '@/services/xtream'
import { isSafeImageUrl } from '@/utils/url'
import FavoriteButton from '@/components/FavoriteButton.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'

const iptvStore = useIptvStore()
const authStore = useAuthStore()
const playerStore = usePlayerStore()
const loadingMovieId = ref<number | null>(null)

const query = computed(() => iptvStore.searchQueryDebounced)

const liveResults = computed(() => iptvStore.filteredChannels)
const movieResults = computed(() => iptvStore.filteredMovies)
const seriesResults = computed(() => iptvStore.filteredSeries)

const hasAnyResults = computed(() =>
  liveResults.value.length > 0 ||
  movieResults.value.length > 0 ||
  seriesResults.value.length > 0
)

const clearSearch = () => {
  iptvStore.searchQuery = ''
}

const channelPlayable = (channel: LiveChannel): PlayableMedia => {
  const streamUrl = authStore.credentials
    ? XtreamService.buildLiveStreamUrl(authStore.credentials, channel.stream_id, 'ts')
    : (channel.streamUrl || '')

  return {
    id: `live_${channel.stream_id}`,
    title: channel.name,
    streamUrl,
    type: 'live',
    icon: channel.stream_icon,
    categoryId: channel.category_id,
  }
}

const moviePlayable = (movie: Movie, duration?: number): PlayableMedia => {
  const ext = movie.container_extension || 'mp4'
  const streamUrl = movie.streamUrl || (authStore.credentials
    ? XtreamService.buildMovieStreamUrl(authStore.credentials, movie.stream_id, ext)
    : '')
  return {
    id: `movie_${movie.stream_id}`,
    title: movie.name,
    streamUrl,
    type: 'movie',
    poster: movie.stream_icon,
    containerExtension: ext,
    categoryId: movie.category_id,
    duration,
  }
}

const seriesFavorite = (series: Series): PlayableMedia => ({
  id: `series_${series.series_id}`,
  title: series.name,
  streamUrl: series.streamUrl || '',
  type: 'series',
  poster: series.cover,
  categoryId: series.category_id,
  seriesId: series.series_id,
})

const playChannel = (channel: LiveChannel) => {
  const playable = channelPlayable(channel)
  const streamUrl = playable.streamUrl

  if (!streamUrl) {
    console.warn('[ZkPlayer] No stream URL for live channel:', channel.name)
    return
  }

  console.log('[ZkPlayer] Playing live channel:', channel.name, '→', streamUrl)

  playerStore.playMedia(playable)
}

const openMovie = async (movie: Movie) => {
  loadingMovieId.value = movie.stream_id
  const ext = movie.container_extension || 'mp4'
  let streamUrl = movie.streamUrl
  let durationSecs = 0

  try {
    if (authStore.credentials) {
      const detail = await XtreamService.getMovieDetail(authStore.credentials, movie.stream_id)
      if (detail?.info) {
        if (detail.info.duration_secs) {
          durationSecs = detail.info.duration_secs
        } else if (detail.info.duration) {
          const d = detail.info.duration
          const hmsMatch = d.match(/(\d+):(\d+):(\d+)/)
          if (hmsMatch) {
            durationSecs = parseInt(hmsMatch[1]) * 3600 + parseInt(hmsMatch[2]) * 60 + parseInt(hmsMatch[3])
          } else {
            const minMatch = d.match(/(\d+)/)
            if (minMatch) durationSecs = parseInt(minMatch[1]) * 60
          }
        }
      }
      if (!streamUrl) {
        streamUrl = XtreamService.buildMovieStreamUrl(authStore.credentials, movie.stream_id, ext)
      }
    }
  } catch {
      if (!streamUrl && authStore.credentials) {
        streamUrl = XtreamService.buildMovieStreamUrl(authStore.credentials, movie.stream_id, ext)
      }
  } finally {
    loadingMovieId.value = null
  }

  if (!streamUrl) {
    console.warn('[ZkPlayer] No stream URL for movie:', movie.name)
    return
  }

  const playable = moviePlayable({ ...movie, streamUrl }, durationSecs || undefined)
  playerStore.playMedia(playable)
}

const openSeries = (series: Series) => {
  if (series.streamUrl) {
    playerStore.playMedia(seriesFavorite(series))
    return
  }

  // For Xtream series without direct streamUrl, navigate to series view
  iptvStore.currentView = 'series'
}

const onImgError = (e: Event) => {
  ;(e.target as HTMLElement).style.display = 'none'
}
</script>
