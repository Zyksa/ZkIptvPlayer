<template>
  <div class="h-full flex flex-col p-6 space-y-4 overflow-hidden">
    <CatalogHeader
      title="Séries Télévisées"
      :icon="Clapperboard"
      description="Saisons, épisodes et enchaînement automatique avec son AC-3/AAC."
      :count="iptvStore.filteredSeries.length"
      count-label="séries"
      :is-loading="iptvStore.isLoadingData"
      :has-rating="true"
      v-model:sort-by="iptvStore.sortBy"
      v-model:layout-mode="iptvStore.layoutMode"
      refresh-title="Actualiser le catalogue de séries"
      @refresh="iptvStore.refreshContent()"
    />

    <div class="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-hidden">
      <FolderPanel
        v-model="iptvStore.seriesCategorySearch"
        :categories="iptvStore.seriesCategories"
        :filtered-categories="iptvStore.filteredSeriesCategories"
        :selected-category="iptvStore.selectedSeriesCategory"
        :all-count="iptvStore.allSeriesList.length"
        all-label="Toutes les séries"
        @select="iptvStore.loadSeries"
      />

      <CatalogContent
        v-model="iptvStore.seriesSearch"
        :items="iptvStore.pagedSeries"
        :item-key="seriesKey"
        :filtered-count="iptvStore.filteredSeries.length"
        :display-limit="iptvStore.displayLimit"
        :is-loading="iptvStore.isLoadingData"
        v-model:layout-mode="iptvStore.layoutMode"
        grid-class="stagger-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-6 gap-4"
        :empty-icon="Clapperboard"
        empty-text="Aucune série trouvée dans ce dossier."
        search-placeholder="Rechercher dans ce dossier..."
        load-more-label="Afficher plus de séries"
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
            @click="openSeriesDetail(item)"
            class="glass-card rounded-md overflow-hidden cursor-pointer group flex flex-col"
          >
            <div class="relative aspect-[2/3] bg-obsidian-950 overflow-hidden">
              <img
                v-if="isSafeImageUrl(item.cover)"
                :src="item.cover"
                :alt="item.name"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                loading="lazy"
                referrerpolicy="no-referrer"
                @error="onImgError"
              />
              <div v-else class="w-full h-full flex items-center justify-center text-slate-600">
                <Clapperboard class="w-8 h-8 stroke-1" />
              </div>

              <div v-if="item.rating" class="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-bold text-amber-400 flex items-center space-x-1 border border-white/10 font-mono">
                <Star class="w-3 h-3 fill-current" />
                <span>{{ Number(item.rating).toFixed(1) }}</span>
              </div>

              <FavoriteButton
                :media="seriesFavorite(item)"
                class="absolute top-1.5 left-1.5 z-10"
              />

              <div v-if="loadingSeriesId === item.series_id" class="absolute inset-0 z-30 bg-black/65 backdrop-blur-sm flex items-center justify-center">
                <LoadingSpinner compact label="Saisons" />
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
              <span class="text-[9px] text-slate-500 font-mono block mt-1">Série TV</span>
            </div>
          </div>
        </template>

        <template #list-item="{ item }">
          <div
            @click="openSeriesDetail(item)"
            class="p-2.5 rounded bg-obsidian-900 border border-white/5 hover:border-brand-500/40 cursor-pointer flex items-center justify-between group transition-colors"
          >
            <div class="flex items-center space-x-3 overflow-hidden">
              <div class="w-9 h-12 rounded bg-obsidian-950 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                <img
                  v-if="isSafeImageUrl(item.cover)"
                  :src="item.cover"
                  :alt="item.name"
                  class="w-full h-full object-cover"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                  @error="onImgError"
                />
                <Clapperboard v-else class="w-4 h-4 text-slate-500" />
              </div>
              <h3
                :title="item.name"
                class="content-title text-xs font-medium text-slate-200 line-clamp-2 leading-snug"
              >{{ item.name }}</h3>
            </div>

            <div class="flex items-center space-x-2">
              <LoadingSpinner v-if="loadingSeriesId === item.series_id" compact />
              <FavoriteButton :media="seriesFavorite(item)" />
              <button
                type="button"
                @click.prevent.stop="openSeriesDetail(item)"
                class="px-3 py-1.5 rounded bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Play class="w-3 h-3 fill-current" />
                <span>Voir Saisons</span>
              </button>
            </div>
          </div>
        </template>
      </CatalogContent>
    </div>

    <!-- Series Seasons & Episodes Modal -->
    <Transition name="modal">
    <div v-if="selectedSeriesDetail" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-obsidian-900 border border-white/15 rounded-lg max-w-4xl w-full h-[85vh] overflow-hidden shadow-2xl flex flex-col relative p-5 space-y-4">
        <button
          type="button"
          @click="selectedSeriesDetail = null"
          class="absolute top-3.5 right-3.5 p-1.5 text-slate-400 hover:text-white rounded bg-white/5 hover:bg-white/10 z-10"
        >
          <X class="w-4 h-4" />
        </button>

        <!-- Series Header -->
        <div class="flex items-start space-x-4 shrink-0">
          <div class="w-20 aspect-[2/3] rounded bg-obsidian-950 border border-white/10 overflow-hidden shrink-0">
            <img
              v-if="isSafeImageUrl(activeSeries?.cover)"
              :src="activeSeries?.cover"
              :alt="activeSeries?.name"
              class="w-full h-full object-cover"
              loading="lazy"
              referrerpolicy="no-referrer"
              @error="onImgError"
            />
          </div>
          <div class="space-y-1">
            <h2 class="text-base font-bold text-slate-100">{{ activeSeries?.name }}</h2>
            <p class="text-xs text-slate-400 line-clamp-2 leading-relaxed">
              {{ selectedSeriesDetail.info?.plot || 'Sélectionnez un épisode ci-dessous pour lancer la lecture.' }}
            </p>
          </div>
        </div>

        <!-- Season Selector Tabs -->
        <div class="flex items-center space-x-2 border-b border-white/10 pb-2 overflow-x-auto shrink-0">
          <button
            v-for="sNum in availableSeasons"
            :key="sNum"
            type="button"
            @click="activeSeason = sNum"
            :class="[
              'px-3 py-1.5 rounded text-xs font-semibold transition-colors shrink-0',
              activeSeason === sNum ? 'bg-brand-600 text-white' : 'bg-white/5 hover:bg-white/10 text-slate-300'
            ]"
          >
            Saison {{ sNum }}
          </button>
        </div>

        <!-- Episode Cards List -->
        <div class="flex-1 overflow-y-auto space-y-2 pr-1">
          <div
            v-for="ep in currentSeasonEpisodes"
            :key="ep.id"
            @click="playEpisode(ep)"
            class="p-3 rounded bg-obsidian-950 border border-white/5 hover:border-brand-500/40 cursor-pointer flex items-center justify-between group transition-colors"
          >
            <div class="flex items-center space-x-3 overflow-hidden">
              <div class="w-10 h-10 rounded bg-brand-600/10 text-brand-accent flex items-center justify-center shrink-0 border border-brand-500/20">
                <Play class="w-4 h-4 fill-current ml-0.5" />
              </div>
              <div class="overflow-hidden">
                <h4 class="content-title text-xs font-semibold text-slate-200 truncate">
                  Épisode {{ ep.episode_num }}: {{ ep.title }}
                </h4>
                <span class="text-[10px] font-mono text-slate-500">.{{ ep.container_extension || 'mp4' }}</span>
              </div>
            </div>

            <button
              type="button"
              class="px-3 py-1.5 rounded bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium flex items-center space-x-1"
            >
              <span>Lire Épisode</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Clapperboard, Play, Star, X } from 'lucide-vue-next'
import type { Series, SeriesDetail, Episode, PlayableMedia } from '@/types/iptv'
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

const activeSeries = ref<Series | null>(null)
const selectedSeriesDetail = ref<SeriesDetail | null>(null)
const activeSeason = ref<number>(1)
const loadingSeriesId = ref<number | null>(null)

const availableSeasons = computed(() => {
  if (!selectedSeriesDetail.value?.episodes) return []
  return Object.keys(selectedSeriesDetail.value.episodes).map(Number).sort((a, b) => a - b)
})

const currentSeasonEpisodes = computed<Episode[]>(() => {
  if (!selectedSeriesDetail.value?.episodes) return []
  return selectedSeriesDetail.value.episodes[activeSeason.value.toString()] || []
})

const seriesKey = (series: Series) => series.series_id

const seriesFavorite = (series: Series): PlayableMedia => ({
  id: `series_${series.series_id}`,
  title: series.name,
  streamUrl: series.streamUrl || '',
  type: 'series',
  poster: series.cover,
  categoryId: series.category_id,
  seriesId: series.series_id,
})

const openSeriesDetail = async (series: Series) => {
  activeSeries.value = series
  if (!authStore.credentials) {
    if (series.streamUrl && activeSeries.value) {
      playM3uSeries(series)
    }
    return
  }
  loadingSeriesId.value = series.series_id
  try {
    selectedSeriesDetail.value = await XtreamService.getSeriesDetail(authStore.credentials, series.series_id)
    if (availableSeasons.value.length > 0) {
      activeSeason.value = availableSeasons.value[0]
    }
  } catch (err) {
    console.error('Failed to fetch series detail:', err)
  } finally {
    loadingSeriesId.value = null
  }
}

const playM3uSeries = (series: Series) => {
  if (!series.streamUrl) return
  playerStore.playMedia(seriesFavorite(series))
}

const episodeDuration = (ep: Episode): number => {
  if (ep.info?.duration_secs) return ep.info.duration_secs
  if (!ep.info?.duration) return 0

  const hmsMatch = ep.info.duration.match(/(\d+):(\d+):(\d+)/)
  if (hmsMatch) {
    return parseInt(hmsMatch[1]) * 3600 + parseInt(hmsMatch[2]) * 60 + parseInt(hmsMatch[3])
  }
  const minMatch = ep.info.duration.match(/(\d+)/)
  return minMatch ? parseInt(minMatch[1]) * 60 : 0
}

const episodePlayable = (ep: Episode, seasonNum: number): PlayableMedia | null => {
  if (!activeSeries.value) return null
  const ext = ep.container_extension || 'mp4'
  const streamUrl = authStore.credentials
    ? XtreamService.buildEpisodeStreamUrl(authStore.credentials, ep.id, ext)
    : (ep.streamUrl || '')
  if (!streamUrl) return null

  return {
    id: `series_${activeSeries.value.series_id}_e${ep.id}`,
    title: `${activeSeries.value.name} - S${seasonNum}E${ep.episode_num}: ${ep.title}`,
    streamUrl,
    type: 'series',
    poster: activeSeries.value.cover,
    containerExtension: ext,
    categoryId: activeSeries.value.category_id,
    seriesId: activeSeries.value.series_id,
    seasonNum,
    episodeNum: Number(ep.episode_num),
    episodeTitle: ep.title,
    duration: episodeDuration(ep) || undefined,
  }
}

const episodeChain = (): PlayableMedia[] => {
  const detail = selectedSeriesDetail.value
  if (!detail) return []

  const episodes = availableSeasons.value.flatMap((seasonNum) =>
    [...(detail.episodes[seasonNum.toString()] || [])]
      .sort((a, b) => Number(a.episode_num) - Number(b.episode_num))
      .map((episode) => ({ episode, seasonNum }))
  )

  const chain: PlayableMedia[] = []
  let next: PlayableMedia | undefined
  for (let index = episodes.length - 1; index >= 0; index--) {
    const { episode, seasonNum } = episodes[index]
    const playable = episodePlayable(episode, seasonNum)
    if (!playable) continue
    if (next) {
      playable.nextEpisode = next
      playable.nextEpisodeLabel = next.seasonNum !== seasonNum
        ? 'Saison suivante'
        : 'Épisode suivant'
    }
    chain.unshift(playable)
    next = playable
  }
  return chain
}

const playEpisode = (ep: Episode) => {
  const playable = episodeChain().find((item) => item.id.endsWith(`_e${ep.id}`))
  if (!playable) return
  selectedSeriesDetail.value = null
  playerStore.playMedia(playable)
}

const onImgError = (e: Event) => {
  ;(e.target as HTMLElement).style.display = 'none'
}
</script>
