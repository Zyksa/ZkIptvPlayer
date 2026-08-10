<template>
  <div class="relative w-full" :class="wrapperClass">
    <Search
      class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-accent/75 pointer-events-none transition-colors group-focus-within:text-brand-accent"
      aria-hidden="true"
    />
    <input
      v-model="model"
      type="text"
      :placeholder="placeholder"
      :aria-label="ariaLabel || placeholder"
      class="w-full glass-input rounded-xl pl-9 pr-8 py-2 text-xs font-sans text-slate-200 placeholder-slate-500"
      @keydown.esc="model = ''"
    />
    <Transition name="expand">
      <button
        v-if="model"
        type="button"
        :aria-label="`Effacer la recherche ${placeholder}`"
        class="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-white/10 active:scale-90"
        @click="model = ''"
      >
        <X class="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </Transition>
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
