<template>
  <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0 bg-obsidian-900 p-3.5 rounded-lg border border-white/10">
    <div>
      <h1 class="text-base font-bold text-slate-100 flex items-center space-x-2">
        <component :is="icon" class="w-5 h-5 text-brand-accent" />
        <span>{{ title }}</span>
      </h1>
      <p class="text-[11px] text-slate-400 mt-0.5">{{ description }}</p>
    </div>

    <div class="flex items-center space-x-2.5 w-full sm:w-auto justify-end">
      <button
        type="button"
        :disabled="isLoading"
        class="p-2 rounded bg-obsidian-950 border border-white/10 hover:border-brand-500/50 text-slate-300 hover:text-white transition-colors"
        :title="refreshTitle"
        @click="$emit('refresh')"
      >
        <RotateCw :class="['w-3.5 h-3.5 text-brand-accent', isLoading ? 'animate-spin' : '']" />
      </button>

      <div class="relative flex items-center">
        <ArrowUpDown class="w-3.5 h-3.5 absolute left-3 text-slate-400 pointer-events-none" />
        <select
          :value="sortBy"
          class="glass-input text-xs rounded pl-8 pr-3 py-1 font-medium bg-obsidian-950 border-white/10 text-slate-200 focus:outline-none cursor-pointer"
          @change="$emit('update:sortBy', ($event.target as HTMLSelectElement).value as SortOption)"
        >
          <option value="name_asc">Nom (A-Z)</option>
          <option value="name_desc">Nom (Z-A)</option>
          <option v-if="hasRating" value="rating">Note IMDb</option>
          <option value="id">Plus récents</option>
        </select>
      </div>

      <div class="flex items-center bg-obsidian-950 p-0.5 rounded border border-white/10 space-x-0.5">
        <button
          type="button"
          :class="['p-1.5 rounded text-xs transition-colors', layoutMode === 'grid' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200']"
          title="Vue Grille"
          @click="$emit('update:layoutMode', 'grid')"
        >
          <LayoutGrid class="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          :class="['p-1.5 rounded text-xs transition-colors', layoutMode === 'list' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200']"
          title="Vue Liste"
          @click="$emit('update:layoutMode', 'list')"
        >
          <List class="w-3.5 h-3.5" />
        </button>
      </div>

      <span class="text-[11px] font-mono text-slate-400 bg-white/5 px-2.5 py-1 rounded border border-white/5 shrink-0">
        {{ count }} {{ countLabel }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RotateCw, ArrowUpDown, LayoutGrid, List } from 'lucide-vue-next'
import type { SortOption, ViewLayout } from '@/stores/iptv'
import type { Component } from 'vue'

defineProps<{
  title: string
  icon: Component
  description: string
  count: number
  countLabel: string
  isLoading: boolean
  sortBy: SortOption
  layoutMode: ViewLayout
  hasRating?: boolean
  refreshTitle: string
}>()

defineEmits<{
  refresh: []
  'update:sortBy': [value: SortOption]
  'update:layoutMode': [value: ViewLayout]
}>()
</script>
