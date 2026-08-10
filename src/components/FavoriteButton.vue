<template>
  <button
    type="button"
    class="p-1.5 rounded-full border backdrop-blur shadow transition-all hover:scale-105 active:scale-90"
    :class="[
      isFavorite
        ? 'bg-rose-500/25 text-rose-300 border-rose-400/50 shadow-rose-500/20'
        : 'bg-black/65 text-white border-white/20 hover:bg-rose-500/25 hover:text-rose-300',
      isPopping ? 'heart-pop' : ''
    ]"
    :title="isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'"
    :aria-label="isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'"
    @click.prevent.stop="toggle"
  >
    <Heart :class="['w-4 h-4 transition-transform', isFavorite ? 'fill-current' : '']" />
  </button>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Heart } from 'lucide-vue-next'
import type { PlayableMedia } from '@/types/iptv'
import { useIptvStore } from '@/stores/iptv'

const props = defineProps<{ media: PlayableMedia }>()
const iptvStore = useIptvStore()
const isFavorite = computed(() => iptvStore.isFavorite(props.media.id))
const isPopping = ref(false)

const toggle = () => {
  isPopping.value = true
  iptvStore.toggleFavorite(props.media)
  setTimeout(() => {
    isPopping.value = false
  }, 350)
}
</script>

