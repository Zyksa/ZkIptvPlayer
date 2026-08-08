<template>
  <div class="lg:col-span-3 bg-obsidian-900 border border-white/10 rounded-lg p-3 flex flex-col overflow-hidden space-y-2.5">
    <div class="flex items-center justify-between">
      <h2 class="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
        <Folder class="w-3.5 h-3.5 text-brand-accent" />
        <span>Dossiers</span>
      </h2>
      <span class="text-[10px] font-mono text-slate-500">({{ categories.length }})</span>
    </div>

    <SearchInput
      v-model="searchModel"
      placeholder="Rechercher un dossier..."
    />

    <div class="flex-1 overflow-y-auto space-y-0.5 pr-1">
      <button
        type="button"
        :class="[
          'w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs font-medium transition-colors',
          selectedCategory === 'all'
            ? 'bg-brand-600 text-white font-semibold'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
        ]"
        @click="$emit('select', 'all')"
      >
        <div class="flex items-center space-x-2 truncate">
          <FolderOpen class="w-3.5 h-3.5 shrink-0 text-amber-400" />
          <span class="truncate">{{ allLabel }}</span>
        </div>
        <span class="text-[10px] font-mono opacity-80">({{ allCount }})</span>
      </button>

      <button
        v-for="cat in filteredCategories"
        :key="cat.category_id"
        type="button"
        :class="[
          'w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs font-medium transition-colors',
          selectedCategory === cat.category_id
            ? 'bg-brand-600 text-white font-semibold'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
        ]"
        @click="$emit('select', cat.category_id)"
      >
        <div class="flex items-center space-x-2 truncate">
          <Folder class="w-3.5 h-3.5 shrink-0 text-slate-500" />
          <span class="truncate">{{ cat.category_name }}</span>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Folder, FolderOpen } from 'lucide-vue-next'
import type { Category } from '@/types/iptv'
import SearchInput from '@/components/SearchInput.vue'

const props = defineProps<{
  categories: Category[]
  filteredCategories: Category[]
  selectedCategory: string
  allCount: number
  allLabel: string
  modelValue: string
}>()

const emit = defineEmits<{
  select: [categoryId: string]
  'update:modelValue': [value: string]
}>()

const searchModel = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})
</script>
