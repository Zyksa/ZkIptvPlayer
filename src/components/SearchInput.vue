<template>
  <div class="relative w-full" :class="wrapperClass">
    <Search
      class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-accent/70 pointer-events-none"
      aria-hidden="true"
    />
    <input
      v-model="model"
      type="text"
      :placeholder="placeholder"
      :aria-label="ariaLabel || placeholder"
      class="w-full glass-input rounded-md pl-9 pr-8 py-2 text-sm text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-brand-500/30 transition-all"
      @keydown.esc="model = ''"
    />
    <button
      v-if="model"
      type="button"
      :aria-label="`Effacer la recherche ${placeholder}`"
      class="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
      @click="model = ''"
    >
      <X class="w-3.5 h-3.5" aria-hidden="true" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { Search, X } from 'lucide-vue-next'

const model = defineModel<string>({ default: '' })

defineProps<{
  placeholder?: string
  wrapperClass?: string
  ariaLabel?: string
}>()
</script>
