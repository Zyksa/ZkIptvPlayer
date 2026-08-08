<template>
  <div class="relative w-full">
    <div
      v-for="(chunk, cIndex) in chunkedItems"
      :key="cIndex"
      class="virtual-chunk"
    >
      <div :class="gridClass">
        <div
          v-for="item in chunk"
          :key="itemKey(item)"
        >
          <slot :item="item" />
        </div>
      </div>
    </div>

    <!-- Sentinel to detect when user approaches the end -->
    <div ref="endSentinel" class="h-1 w-full" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps<{
  items: any[]
  itemKey: (item: any) => string | number
  gridClass: string
  chunkSize?: number
  bufferChunks?: number
  scrollContainer?: HTMLElement | null
  loadMore?: () => void
}>()

const endSentinel = ref<HTMLElement | null>(null)

const chunkSize = computed(() => Math.max(1, props.chunkSize || 24))

const chunkedItems = computed(() => {
  const chunks: any[][] = []
  for (let i = 0; i < props.items.length; i += chunkSize.value) {
    chunks.push(props.items.slice(i, i + chunkSize.value))
  }
  return chunks
})

let observer: IntersectionObserver | null = null

onMounted(async () => {
  await nextTick()
  const scrollEl = props.scrollContainer || null

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.target === endSentinel.value && entry.isIntersecting) {
          props.loadMore?.()
        }
      })
    },
    {
      root: scrollEl,
      rootMargin: '200px 0px',
      threshold: 0,
    }
  )

  if (endSentinel.value && props.loadMore) observer.observe(endSentinel.value)
})

onUnmounted(() => {
  observer?.disconnect()
  observer = null
})

</script>

<style scoped>
.virtual-chunk {
  content-visibility: auto;
  contain-intrinsic-size: auto 1600px;
}
</style>
