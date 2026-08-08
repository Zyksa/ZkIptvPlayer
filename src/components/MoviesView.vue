<template>
  <div class="h-full flex flex-col p-6 space-y-4 overflow-hidden">
    <CatalogHeader
      title="Films VOD"
      :icon="Film"
      description="Catalogue de films 4K / HD avec décodage matériel GPU Direct3D11."
      :count="iptvStore.filteredMovies.length"
      count-label="films"
      :is-loading="iptvStore.isLoadingData"
      :has-rating="true"
      v-model:sort-by="iptvStore.sortBy"
      v-model:layout-mode="iptvStore.layoutMode"
      refresh-title="Actualiser le catalogue de films"
      @refresh="iptvStore.refreshContent()"
    />

    <div class="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-hidden">
      <FolderPanel
        v-model="iptvStore.vodCategorySearch"
        :categories="iptvStore.vodCategories"
        :filtered-categories="iptvStore.filteredVodCategories"
        :selected-category="iptvStore.selectedVodCategory"
        :all-count="iptvStore.allVodMovies.length"
        all-label="Tous les films"
        @select="iptvStore.loadMovies"
      />

      <CatalogContent
        v-model="iptvStore.vodSearch"
        :items="iptvStore.pagedMovies"
        :item-key="movieKey"
        :filtered-count="iptvStore.filteredMovies.length"
        :display-limit="iptvStore.displayLimit"
        :is-loading="iptvStore.isLoadingData"
        v-model:layout-mode="iptvStore.layoutMode"
        grid-class="stagger-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-6 gap-4"
        :empty-icon="Film"
        empty-text="Aucun film trouvé dans ce dossier."
        search-placeholder="Rechercher dans ce dossier..."
        load-more-label="Afficher plus de films"
        :global-search-query="iptvStore.searchQuery"
        :load-more="iptvStore.loadMore"
      >
        <template #skeleton>
          <div v-for="i in 12" :key="i" class="space-y-2">
            <div class="aspect-[2/3] rounded bg-obsidian-900 border border-white/5 skeleton-loader"></div>
            <div class="h-3 w-3/4 bg-obsidian-900 rounded skeleton-loader"></div>
          </div>
        </template>

        <template #grid-item="{ item }">
          <div
            @click="openMovieDetail(item)"
            class="glass-card rounded-md overflow-hidden cursor-pointer group flex flex-col"
          >
            <div class="relative aspect-[2/3] bg-obsidian-950 overflow-hidden">
              <img
                v-if="isSafeImageUrl(item.stream_icon)"
                :src="item.stream_icon"
                :alt="item.name"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                loading="lazy"
                referrerpolicy="no-referrer"
                @error="onImgError"
              />
              <div v-else class="w-full h-full flex items-center justify-center text-slate-600">
                <Film class="w-8 h-8 stroke-1" />
              </div>

              <div v-if="item.rating" class="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-bold text-amber-400 flex items-center space-x-1 border border-white/10 font-mono">
                <Star class="w-3 h-3 fill-current" />
                <span>{{ Number(item.rating).toFixed(1) }}</span>
              </div>

              <FavoriteButton
                :media="moviePlayable(item)"
                class="absolute top-1.5 left-1.5 z-10"
              />

              <div v-if="loadingMovieId === item.stream_id" class="absolute inset-0 z-30 bg-black/65 backdrop-blur-sm flex items-center justify-center">
                <LoadingSpinner compact label="Détails" />
              </div>

              <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div class="w-10 h-10 rounded-full bg-brand-600 text-white flex items-center justify-center shadow-lg">
                  <Play class="w-5 h-5 ml-0.5 fill-current" />
                </div>
              </div>
            </div>

            <div class="p-3">
              <h3
                :title="item.name"
                class="content-title text-xs font-medium text-slate-200 line-clamp-3 leading-snug"
              >
                {{ item.name }}
              </h3>
              <span class="text-[9px] text-slate-500 font-mono uppercase mt-1 block">
                .{{ item.container_extension || 'mp4' }}
              </span>
            </div>
          </div>
        </template>

        <template #list-item="{ item }">
          <div
            @click="openMovieDetail(item)"
            class="p-2.5 rounded bg-obsidian-900 border border-white/5 hover:border-brand-500/40 cursor-pointer flex items-center justify-between group transition-colors"
          >
            <div class="flex items-center space-x-3 overflow-hidden">
              <div class="w-9 h-12 rounded bg-obsidian-950 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                <img
                  v-if="isSafeImageUrl(item.stream_icon)"
                  :src="item.stream_icon"
                  :alt="item.name"
                  class="w-full h-full object-cover"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                  @error="onImgError"
                />
                <Film v-else class="w-4 h-4 text-slate-500" />
              </div>
              <div class="overflow-hidden">
                <h3
                  :title="item.name"
                  class="content-title text-xs font-medium text-slate-200 line-clamp-2 leading-snug"
                >{{ item.name }}</h3>
                <div class="flex items-center space-x-2 text-[10px] text-slate-400 font-mono mt-0.5">
                  <span v-if="item.rating" class="text-amber-400 font-bold">⭐️ {{ Number(item.rating).toFixed(1) }}</span>
                  <span class="uppercase">.{{ item.container_extension || 'mp4' }}</span>
                </div>
              </div>
            </div>

            <div class="flex items-center space-x-2">
              <LoadingSpinner v-if="loadingMovieId === item.stream_id" compact />
              <FavoriteButton :media="moviePlayable(item)" />
              <button
                type="button"
                @click.prevent.stop="playMovie(item)"
                class="px-3 py-1.5 rounded bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Play class="w-3 h-3 fill-current" />
                <span>Lire</span>
              </button>
            </div>
          </div>
        </template>
      </CatalogContent>
    </div>

    <!-- Movie Detail Modal -->
    <Transition name="modal">
    <div v-if="selectedMovieDetail" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-obsidian-900 border border-white/15 rounded-lg max-w-2xl w-full overflow-hidden shadow-2xl space-y-4 p-5 relative">
        <button
          type="button"
          @click="selectedMovieDetail = null"
          class="absolute top-3.5 right-3.5 p-1.5 text-slate-400 hover:text-white rounded bg-white/5 hover:bg-white/10"
        >
          <X class="w-4 h-4" />
        </button>

        <div class="flex flex-col sm:flex-row gap-5">
          <div class="w-32 shrink-0 aspect-[2/3] rounded overflow-hidden bg-obsidian-950 border border-white/10">
            <img
              v-if="isSafeImageUrl(selectedMovieDetail.info?.cover_big || activeMovie?.stream_icon)"
              :src="selectedMovieDetail.info?.cover_big || activeMovie?.stream_icon"
              :alt="activeMovie?.name"
              class="w-full h-full object-cover"
              loading="lazy"
              referrerpolicy="no-referrer"
              @error="onImgError"
            />
          </div>

          <div class="flex-1 space-y-2.5">
            <div>
              <h2 class="text-base font-bold text-slate-100">{{ activeMovie?.name }}</h2>
              <div class="flex items-center space-x-2.5 text-[11px] text-slate-400 mt-1">
                <span v-if="selectedMovieDetail.info?.releasedate">{{ selectedMovieDetail.info.releasedate }}</span>
                <span v-if="selectedMovieDetail.info?.episode_run_time">{{ selectedMovieDetail.info.episode_run_time }} min</span>
                <span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[10px]">DOLBY 5.1 / DTS</span>
              </div>
            </div>

            <p class="text-xs text-slate-300 line-clamp-4 leading-relaxed">
              {{ selectedMovieDetail.info?.plot || selectedMovieDetail.info?.description || 'Aucun synopsis disponible.' }}
            </p>

            <div class="pt-2 flex items-center space-x-3">
              <button
                type="button"
                @click="playMovie(activeMovie!)"
                class="px-5 py-2 rounded bg-brand-600 hover:bg-brand-500 text-white font-medium text-xs flex items-center space-x-2 shadow"
              >
                <Play class="w-3.5 h-3.5 fill-current" />
                <span>Lancer le Film</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Film, Play, Star, X } from 'lucide-vue-next'
import type { Movie, MovieDetail, PlayableMedia } from '@/types/iptv'
import { useIptvStore } from '@/stores/iptv'
import { useAuthStore } from '@/stores/auth'
import { usePlayerStore } from '@/stores/player'
import { XtreamService } from '@/services/xtream'
import CatalogHeader from '@/components/CatalogHeader.vue'
import FolderPanel from '@/components/FolderPanel.vue'
import CatalogContent from '@/components/CatalogContent.vue'
import FavoriteButton from '@/components/FavoriteButton.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import { isSafeImageUrl } from '@/utils/url'

const iptvStore = useIptvStore()
const authStore = useAuthStore()
const playerStore = usePlayerStore()

const activeMovie = ref<Movie | null>(null)
const selectedMovieDetail = ref<MovieDetail | null>(null)
const loadingMovieId = ref<number | null>(null)

const movieKey = (movie: Movie) => movie.stream_id

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

const openMovieDetail = async (movie: Movie) => {
  activeMovie.value = movie
  if (!authStore.credentials) {
    playMovie(movie)
    return
  }
  loadingMovieId.value = movie.stream_id
  try {
    selectedMovieDetail.value = await XtreamService.getMovieDetail(authStore.credentials, movie.stream_id)
  } catch {
    playMovie(movie)
  } finally {
    loadingMovieId.value = null
  }
}

const playMovie = (movie: Movie) => {
  const currentDetail = selectedMovieDetail.value
  selectedMovieDetail.value = null
  const ext = movie.container_extension || 'mp4'
  let streamUrl = movie.streamUrl
  if (!streamUrl && authStore.credentials) {
    streamUrl = XtreamService.buildMovieStreamUrl(authStore.credentials, movie.stream_id, ext)
  }

  let durationSecs = 0
  if (currentDetail?.info) {
    if (currentDetail.info.duration_secs) {
      durationSecs = currentDetail.info.duration_secs
    } else if (currentDetail.info.duration) {
      const d = currentDetail.info.duration
      const hmsMatch = d.match(/(\d+):(\d+):(\d+)/)
      if (hmsMatch) {
        durationSecs = parseInt(hmsMatch[1]) * 3600 + parseInt(hmsMatch[2]) * 60 + parseInt(hmsMatch[3])
      } else {
        const minMatch = d.match(/(\d+)/)
        if (minMatch) durationSecs = parseInt(minMatch[1]) * 60
      }
    }
  }

  const playable = moviePlayable({ ...movie, streamUrl }, durationSecs || undefined)
  playerStore.playMedia(playable)
}

const onImgError = (e: Event) => {
  ;(e.target as HTMLElement).style.display = 'none'
}
</script>
