<template>
  <div ref="container" class="lg:col-span-9 overflow-y-auto pr-1 space-y-4 flex flex-col">
    <!-- Local Folder Search -->
    <div class="sticky top-0 z-10 flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-obsidian-950/90 backdrop-blur p-2 -mx-2 rounded-lg border border-white/5">
      <SearchInput
        v-model="searchModel"
        :placeholder="searchPlaceholder"
        wrapper-class="flex-1 w-full sm:max-w-md"
      />
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div v-if="globalSearchQuery" class="text-xs text-slate-400 whitespace-nowrap">
          Recherche globale : <span class="text-brand-accent font-medium">{{ globalSearchQuery }}</span>
          <span class="text-slate-500 font-mono ml-1">({{ filteredCount }})</span>
        </div>
        <div v-if="searchModel" class="text-xs text-slate-400 whitespace-nowrap">
          Recherche : <span class="text-brand-accent font-medium">{{ searchModel }}</span>
          <span class="text-slate-500 font-mono ml-1">({{ filteredCount }})</span>
        </div>
      </div>
    </div>

    <!-- Skeleton Loader state when fetching -->
    <div v-if="isLoading" class="space-y-4 py-1">
      <div class="flex justify-center py-2">
        <LoadingSpinner compact :label="loadingLabel" />
      </div>
      <div class="grid gap-3" :class="gridClass">
        <slot name="skeleton" />
      </div>
    </div>

    <div v-else-if="items.length === 0" class="flex flex-col items-center justify-center h-64 text-slate-500">
      <component :is="emptyIcon" class="w-10 h-10 stroke-1 text-slate-600 mb-2" />
      <p class="text-xs font-medium">{{ emptyText }}</p>
    </div>

    <!-- Grid View -->
    <VirtualGrid
      v-else-if="layoutMode === 'grid' && useVirtual"
      :items="items"
      :item-key="itemKey"
      :grid-class="gridClass"
      :scroll-container="container"
      :load-more="loadMore"
      :chunk-size="60"
    >
      <template #default="{ item }">
        <slot name="grid-item" :item="item" />
      </template>
    </VirtualGrid>

    <div
      v-else-if="layoutMode === 'grid'"
      :class="gridClass"
    >
      <div v-for="item in items" :key="itemKey(item)">
        <slot name="grid-item" :item="item" />
      </div>
    </div>

    <!-- List View -->
    <VirtualList
      v-else-if="useVirtual"
      :items="items"
      :item-key="itemKey"
      :scroll-container="container"
      :load-more="loadMore"
      :chunk-size="40"
    >
      <template #default="{ item }">
        <slot name="list-item" :item="item" />
      </template>
    </VirtualList>

    <div v-else class="space-y-1.5">
      <div v-for="item in items" :key="itemKey(item)">
        <slot name="list-item" :item="item" />
      </div>
    </div>

    <!-- Load More Pagination Button -->
    <div v-if="filteredCount > displayLimit" class="pt-4 text-center">
      <button
        type="button"
        class="px-5 py-2 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-medium text-xs transition-colors"
        @click="loadMore"
      >
        {{ loadMoreLabel }} ({{ displayLimit }} / {{ filteredCount }})
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, type Component } from 'vue'
import SearchInput from '@/components/SearchInput.vue'
import VirtualGrid from '@/components/VirtualGrid.vue'
import VirtualList from '@/components/VirtualList.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import type { ViewLayout } from '@/stores/iptv'

const props = withDefaults(defineProps<{
  items: any[]
  itemKey: (item: any) => string | number
  filteredCount: number
  displayLimit: number
  isLoading: boolean
  layoutMode: ViewLayout
  gridClass: string
  emptyIcon: Component
  emptyText: string
  searchPlaceholder: string
  loadMoreLabel: string
  globalSearchQuery: string
  modelValue: string
  loadMore: () => void
  loadingLabel?: string
}>(), {
  loadingLabel: 'Chargement du catalogue',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const container = ref<HTMLElement | null>(null)
const VIRTUALIZE_THRESHOLD = 200

const searchModel = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const useVirtual = computed(() => props.items.length > VIRTUALIZE_THRESHOLD)
</script>
