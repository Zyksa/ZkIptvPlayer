<template>
  <button
    type="button"
    class="p-1.5 rounded-full border backdrop-blur transition-colors shadow hover:scale-110"
    :class="isFavorite
      ? 'bg-rose-500/25 text-rose-300 border-rose-400/50'
      : 'bg-black/65 text-white border-white/20 hover:bg-rose-500/25 hover:text-rose-300'"
    :title="isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'"
    :aria-label="isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'"
    @click.prevent.stop="iptvStore.toggleFavorite(media)"
  >
    <Heart :class="['w-4 h-4', isFavorite ? 'fill-current' : '']" />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Heart } from 'lucide-vue-next'
import type { PlayableMedia } from '@/types/iptv'
import { useIptvStore } from '@/stores/iptv'

const props = defineProps<{ media: PlayableMedia }>()
const iptvStore = useIptvStore()
const isFavorite = computed(() => iptvStore.isFavorite(props.media.id))
</script>
