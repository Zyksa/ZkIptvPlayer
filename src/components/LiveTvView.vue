<template>
  <div class="h-full flex flex-col p-6 space-y-4 overflow-hidden">
    <CatalogHeader
      title="Direct TV"
      :icon="Tv"
      description="Diffusion en direct HLS (.m3u8) / MPEG-TS avec accélération matérielle Direct3D11."
      :count="iptvStore.filteredChannels.length"
      count-label="chaînes"
      :is-loading="iptvStore.isLoadingData"
      v-model:sort-by="iptvStore.sortBy"
      v-model:layout-mode="iptvStore.layoutMode"
      refresh-title="Actualiser les chaînes TV"
      @refresh="iptvStore.refreshContent()"
    />

    <div class="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-hidden">
      <FolderPanel
        v-model="iptvStore.liveCategorySearch"
        :categories="iptvStore.liveCategories"
        :filtered-categories="iptvStore.filteredLiveCategories"
        :selected-category="iptvStore.selectedLiveCategory"
        :all-count="iptvStore.allLiveChannels.length"
        all-label="Toutes les chaînes"
        @select="iptvStore.loadLiveChannels"
      />

      <CatalogContent
        v-model="iptvStore.liveSearch"
        :items="iptvStore.pagedChannels"
        :item-key="channelKey"
        :filtered-count="iptvStore.filteredChannels.length"
        :display-limit="iptvStore.displayLimit"
        :is-loading="iptvStore.isLoadingData"
        v-model:layout-mode="iptvStore.layoutMode"
        grid-class="stagger-grid grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
        :empty-icon="Tv"
        empty-text="Aucune chaîne trouvée dans ce dossier."
        search-placeholder="Rechercher dans ce dossier..."
        load-more-label="Afficher plus de chaînes"
        :global-search-query="iptvStore.searchQuery"
        :load-more="iptvStore.loadMore"
      >
        <template #skeleton>
          <div v-for="i in 12" :key="i" class="h-28 rounded-lg bg-obsidian-900 border border-white/5 skeleton-loader"></div>
        </template>

        <template #grid-item="{ item }">
          <div
            @click="playChannel(item)"
            class="glass-card p-4 rounded-lg cursor-pointer flex flex-col justify-between space-y-3 relative group border border-white/5 hover:border-brand-500/50 transition-all"
          >
            <FavoriteButton
              :media="channelPlayable(item)"
              class="absolute top-2 right-2 z-10"
            />
            <div class="flex items-start space-x-3 overflow-hidden">
              <div class="w-12 h-12 rounded-lg bg-obsidian-950 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center p-1.5">
                <img
                  v-if="isSafeImageUrl(item.stream_icon)"
                  :src="item.stream_icon"
                  :alt="item.name"
                  class="w-full h-full object-contain"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                  @error="onImgError"
                />
                <Tv v-else class="w-6 h-6 text-slate-500" />
              </div>
              <div class="overflow-hidden min-w-0">
                <h3
                  :title="item.name"
                  class="content-title text-sm font-medium text-slate-200 line-clamp-2 leading-snug"
                >
                  {{ item.name }}
                </h3>
                <span class="text-[10px] text-slate-500 font-mono">#{{ item.stream_id }}</span>
              </div>
            </div>

            <button
              type="button"
              @click.prevent.stop="playChannel(item)"
              class="w-full py-1.5 rounded bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium flex items-center justify-center space-x-1 shadow transition-colors"
            >
              <Play class="w-3.5 h-3.5 fill-current" />
              <span>Regarder</span>
            </button>
          </div>
        </template>

        <template #list-item="{ item }">
          <div
            @click="playChannel(item)"
            class="p-3 rounded-lg bg-obsidian-900 border border-white/5 hover:border-brand-500/40 cursor-pointer flex items-center justify-between group transition-colors"
          >
            <div class="flex items-center space-x-3 overflow-hidden flex-1 min-w-0">
              <div class="w-10 h-10 rounded-lg bg-obsidian-950 border border-white/10 overflow-hidden shrink-0 p-1 flex items-center justify-center">
                <img
                  v-if="isSafeImageUrl(item.stream_icon)"
                  :src="item.stream_icon"
                  :alt="item.name"
                  class="w-full h-full object-contain"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                  @error="onImgError"
                />
                <Tv v-else class="w-5 h-5 text-slate-500" />
              </div>
              <h3
                :title="item.name"
                class="content-title text-sm font-medium text-slate-200 line-clamp-2 leading-snug min-w-0"
              >{{ item.name }}</h3>
            </div>

            <div class="flex items-center space-x-2">
              <FavoriteButton :media="channelPlayable(item)" />
              <button
                type="button"
                @click.prevent.stop="playChannel(item)"
                class="px-4 py-1.5 rounded bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Play class="w-3.5 h-3.5 fill-current" />
                <span>Regarder</span>
              </button>
            </div>
          </div>
        </template>
      </CatalogContent>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Tv, Play } from 'lucide-vue-next'
import type { LiveChannel, PlayableMedia } from '@/types/iptv'
import { useIptvStore } from '@/stores/iptv'
import { useAuthStore } from '@/stores/auth'
import { usePlayerStore } from '@/stores/player'
import { XtreamService } from '@/services/xtream'
import CatalogHeader from '@/components/CatalogHeader.vue'
import FolderPanel from '@/components/FolderPanel.vue'
import CatalogContent from '@/components/CatalogContent.vue'
import FavoriteButton from '@/components/FavoriteButton.vue'
import { isSafeImageUrl } from '@/utils/url'

const iptvStore = useIptvStore()
const authStore = useAuthStore()
const playerStore = usePlayerStore()

const channelKey = (channel: LiveChannel) => channel.stream_id

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

const onImgError = (e: Event) => {
  ;(e.target as HTMLElement).style.display = 'none'
}
</script>
